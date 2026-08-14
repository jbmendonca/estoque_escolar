# Deploy em produção

Publica o Sistema de Controle de Estoque Escolar em uma VPS que **já roda Traefik**
com outros serviços. O deploy se acopla ao Traefik existente e não altera,
reinicia ou reconfigura nada que já esteja no ar.

## Arquitetura publicada

O projeto é um **monolito Next.js** — a interface e as rotas de API (`/api/*`)
vivem no mesmo processo. Por isso os dois domínios apontam para o mesmo container:

| Domínio | Serve |
| --- | --- |
| `estoque.tkrtecnologia.cloud` | Interface web (frontend) |
| `apiestoque.tkrtecnologia.cloud` | Mesma aplicação; a API fica em `/api/*` |

Componentes criados (todos com nomes próprios, sem colisão):

- container `estoque_escolar_app` — aplicação Next.js, porta 3000 **interna**
- container `estoque_escolar_db` — PostgreSQL 16, **sem porta publicada no host**
- rede `estoque_escolar_internal` — tráfego app ↔ banco
- volume `estoque_escolar_pgdata` — dados do PostgreSQL

## Pré-requisitos na VPS

- Docker + plugin `docker compose` v2
- Um container Traefik em execução, com um `certresolver` ACME já configurado
- Registros DNS `A` de `estoque` e `apiestoque` apontando para o **IP público da VPS**

## Passo a passo

```bash
# 1. Na VPS, obtenha o código
mkdir -p /opt && cd /opt
git clone https://github.com/jbmendonca/estoque_escolar.git estoque-escolar
cd estoque-escolar

# 2. Configure os segredos
cp deploy/env.production.example .env.production
chmod 600 .env.production
nano .env.production        # preencha POSTGRES_PASSWORD, SESSION_SECRET e ADMIN_PASSWORD

# 3. Execute o deploy
bash deploy/deploy.sh
```

O script, em ordem: valida pré-requisitos → inventaria os containers em execução →
detecta a rede e o `certresolver` do Traefik → aborta se algum dos domínios já
estiver roteado por outro container → confere o DNS → constrói a imagem →
sobe banco e app → aplica as migrations → roda o seed de produção →
testa os dois domínios → confirma que nenhum container pré-existente parou.

## Atualizações posteriores

```bash
cd /opt/estoque-escolar && git pull && bash deploy/deploy.sh
```

O script é idempotente: o seed usa `upsert` e as migrations usam `migrate deploy`.
Nenhum dado existente é apagado.

## Operação

```bash
docker logs -f estoque_escolar_app                      # logs da aplicação
docker compose -f docker-compose.prod.yml -p estoque-escolar ps
docker exec -it estoque_escolar_db psql -U estoque -d estoque_escolar

# Backup do banco
docker exec estoque_escolar_db pg_dump -U estoque estoque_escolar \
  | gzip > backup-estoque-$(date +%F).sql.gz
```

## Se a detecção do Traefik falhar

Descubra os valores e preencha manualmente no `.env.production`:

```bash
# nome da rede do Traefik
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' <container-traefik>

# nome do certresolver usado pelos outros serviços
docker inspect <container-traefik> | grep -o 'certificatesresolvers\.[A-Za-z0-9_-]*'
```
