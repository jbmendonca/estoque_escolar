#!/usr/bin/env bash
# Deploy do Sistema de Controle de Estoque Escolar na VPS.
#
# Estratégia: acopla-se ao Traefik JÁ EXISTENTE (detectado automaticamente).
# Não publica portas no host, não reinicia nem reconfigura nenhum outro
# serviço/container, e usa rede + volume próprios.
#
# Uso:  sudo bash deploy/deploy.sh
set -Eeuo pipefail

RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; BLD=$'\e[1m'; RST=$'\e[0m'
info() { echo "${BLD}==>${RST} $*"; }
ok()   { echo "${GRN}  ok${RST} $*"; }
warn() { echo "${YLW}  ! ${RST} $*"; }
die()  { echo "${RED}  x ${RST} $*" >&2; exit 1; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
PROJECT="estoque-escolar"
ENV_FILE=".env.production"

# ---------------------------------------------------------------- pré-requisitos
info "Verificando pré-requisitos"
command -v docker >/dev/null 2>&1 || die "docker não encontrado."
docker compose version >/dev/null 2>&1 || die "plugin 'docker compose' (v2) não encontrado."
[[ -f "$COMPOSE_FILE" ]] || die "$COMPOSE_FILE não encontrado em $REPO_DIR."
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE não encontrado. Copie de deploy/env.production.example e preencha."
ok "docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?')"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
: "${APP_HOST:?defina APP_HOST no $ENV_FILE}"
: "${API_HOST:?defina API_HOST no $ENV_FILE}"
: "${ADMIN_EMAIL:?defina ADMIN_EMAIL no $ENV_FILE}"
: "${ADMIN_PASSWORD:?defina ADMIN_PASSWORD no $ENV_FILE}"
: "${POSTGRES_PASSWORD:?defina POSTGRES_PASSWORD no $ENV_FILE}"
: "${SESSION_SECRET:?defina SESSION_SECRET no $ENV_FILE}"

# ---------------------------------------------------- inventário do que já roda
info "Inventariando containers em execução (nenhum será alterado)"
docker ps --format '  - {{.Names}} ({{.Image}})' || true
RUNNING_BEFORE="$(docker ps -q | sort)"

# ------------------------------------------------------------ detectar Traefik
info "Detectando Traefik"
TRAEFIK_CID="$(docker ps --filter 'label=org.opencontainers.image.title=Traefik' -q | head -1)"
if [[ -z "$TRAEFIK_CID" ]]; then
  TRAEFIK_CID="$(docker ps --format '{{.ID}} {{.Image}}' | awk '/traefik/ {print $1; exit}')"
fi
[[ -n "$TRAEFIK_CID" ]] || die "Nenhum container Traefik em execução. Ajuste o proxy manualmente."
TRAEFIK_NAME="$(docker inspect -f '{{.Name}}' "$TRAEFIK_CID" | sed 's#^/##')"
ok "Traefik: $TRAEFIK_NAME"

# Rede do Traefik (ignora bridge/host/none). Permite override via env.
if [[ -z "${TRAEFIK_NETWORK:-}" ]]; then
  TRAEFIK_NETWORK="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$TRAEFIK_CID" \
    | grep -vE '^(bridge|host|none)$' | head -1)"
fi
[[ -n "$TRAEFIK_NETWORK" ]] || die "Não foi possível determinar a rede do Traefik. Defina TRAEFIK_NETWORK no $ENV_FILE."
ok "Rede do proxy: $TRAEFIK_NETWORK"

# Resolver ACME já configurado no Traefik (reutilizamos — não reconfiguramos).
if [[ -z "${TRAEFIK_CERTRESOLVER:-}" ]]; then
  TRAEFIK_CERTRESOLVER="$(docker inspect -f '{{range .Args}}{{println .}}{{end}}' "$TRAEFIK_CID" \
    | grep -oP '(?<=certificatesresolvers\.)[A-Za-z0-9_-]+' | head -1)"
fi
if [[ -z "$TRAEFIK_CERTRESOLVER" ]]; then
  TRAEFIK_CERTRESOLVER="$(docker inspect -f '{{json .Config.Labels}}' "$TRAEFIK_CID" \
    | grep -oP '(?<=certresolver=)[A-Za-z0-9_-]+' | head -1)"
fi
[[ -n "$TRAEFIK_CERTRESOLVER" ]] || die \
  "Não achei um certresolver ACME no Traefik. Defina TRAEFIK_CERTRESOLVER no $ENV_FILE com o nome usado pelos outros serviços."
ok "Cert resolver: $TRAEFIK_CERTRESOLVER"

export TRAEFIK_NETWORK TRAEFIK_CERTRESOLVER

# ------------------------------------------------------- checagem de conflitos
info "Checando conflitos de rota no Traefik"
for host in "$APP_HOST" "$API_HOST"; do
  hit="$(docker ps --format '{{.Names}}' | while read -r c; do
      docker inspect -f '{{json .Config.Labels}}' "$c" 2>/dev/null \
        | grep -q "Host(\`$host\`)" && echo "$c"
    done | grep -v '^estoque_escolar_app$' || true)"
  [[ -z "$hit" ]] || die "O host $host já é roteado pelo container: $hit. Resolva antes de prosseguir."
done
ok "Sem conflito para $APP_HOST e $API_HOST"

# ------------------------------------------------------------------ DNS (aviso)
info "Conferindo DNS"
PUBLIC_IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo '')"
for host in "$APP_HOST" "$API_HOST"; do
  resolved="$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1; exit}')"
  if [[ -z "$resolved" ]]; then
    warn "$host não resolve — o Let's Encrypt vai falhar até o DNS propagar."
  elif [[ -n "$PUBLIC_IP" && "$resolved" != "$PUBLIC_IP" ]]; then
    warn "$host aponta para $resolved, mas o IP público desta VPS é $PUBLIC_IP. Corrija o registro A."
  else
    ok "$host -> $resolved"
  fi
done

# ------------------------------------------------------------------- build/sobe
info "Construindo a imagem (pode levar alguns minutos)"
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" --env-file "$ENV_FILE" build

info "Subindo banco de dados"
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" --env-file "$ENV_FILE" up -d db
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" -p "$PROJECT" --env-file "$ENV_FILE" \
       exec -T db pg_isready -U estoque -d estoque_escolar >/dev/null 2>&1; then
    ok "PostgreSQL pronto"; break
  fi
  [[ $i -eq 30 ]] && die "PostgreSQL não ficou pronto a tempo."
  sleep 2
done

info "Subindo aplicação"
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" --env-file "$ENV_FILE" up -d app

# ------------------------------------------------------------ migrations e seed
info "Aplicando migrations do Prisma"
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" --env-file "$ENV_FILE" \
  exec -T app npx prisma migrate deploy

info "Executando seed de produção"
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" --env-file "$ENV_FILE" \
  exec -T \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_NAME="${ADMIN_NAME:-Administrador do Sistema}" \
  -e SCHOOL_NAME="${SCHOOL_NAME:-Escola Municipal}" \
  -e SCHOOL_CODE="${SCHOOL_CODE:-ESC-001}" \
  app npx tsx prisma/seed-prod.ts

# ----------------------------------------------------------------- verificações
info "Verificando a aplicação"
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" --env-file "$ENV_FILE" ps

for i in $(seq 1 20); do
  code="$(docker run --rm --network "$TRAEFIK_NETWORK" curlimages/curl:latest \
    -s -o /dev/null -w '%{http_code}' --max-time 5 http://estoque_escolar_app:3000/login 2>/dev/null || echo 000)"
  [[ "$code" =~ ^(200|307|308)$ ]] && { ok "App responde internamente (HTTP $code)"; break; }
  [[ $i -eq 20 ]] && warn "App não respondeu internamente. Veja: docker logs estoque_escolar_app"
  sleep 3
done

info "Aguardando emissão do certificado TLS (até 90s)"
for host in "$APP_HOST" "$API_HOST"; do
  for i in $(seq 1 18); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "https://$host/login" 2>/dev/null || echo 000)"
    if [[ "$code" =~ ^(200|307|308|401)$ ]]; then ok "https://$host -> HTTP $code"; break; fi
    [[ $i -eq 18 ]] && warn "https://$host ainda não responde (último código: $code). Veja os logs do Traefik."
    sleep 5
  done
done

# ------------------------------------------------------- confirma não-regressão
info "Confirmando que os serviços pré-existentes seguem intactos"
STOPPED="$(comm -23 <(echo "$RUNNING_BEFORE") <(docker ps -q | sort) || true)"
if [[ -n "$STOPPED" ]]; then
  warn "Containers que pararam durante o deploy:"; echo "$STOPPED"
else
  ok "Nenhum container pré-existente foi parado"
fi

echo
echo "${GRN}${BLD}Deploy concluído.${RST}"
echo "  Frontend : https://$APP_HOST"
echo "  API      : https://$API_HOST/api"
echo "  Admin    : $ADMIN_EMAIL"
echo "  Logs     : docker logs -f estoque_escolar_app"
