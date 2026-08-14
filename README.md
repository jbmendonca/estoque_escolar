# Sistema de Controle de Estoque Escolar

Aplicação web para controle de estoque de **Merenda Escolar** e **Materiais Escolares**, com
controle individual por escola, perfis de acesso (RBAC), movimentações rastreáveis e imutáveis,
controle de lote/validade com FEFO, dashboard e auditoria.

## Tecnologias

Next.js 15 (App Router) · TypeScript · React 19 · PostgreSQL 16 · Prisma · Tailwind CSS ·
Zod · argon2id · iron-session · Vitest · ESLint + Prettier · Docker

## Requisitos

- Node.js 20+ (testado com Node 24)
- Docker Desktop (para o PostgreSQL)

## Instalação

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente (edite se necessário; nunca comite segredos reais)
cp .env.example .env

# 3. Banco de dados (PostgreSQL via Docker)
docker compose up -d db

# 4. Migrations e dados iniciais
npx prisma migrate deploy
npm run seed

# 5. Rodar a aplicação
npm run dev
```

Aplicação em **http://localhost:3000**

## Multi-tenant (uma escola = um ambiente isolado)

Cada escola é um **tenant**: itens, saldos, lotes, movimentações, inventários, cadastros e
usuários pertencem a uma única escola e **não são visíveis por outra**.

### Níveis de administração

| Perfil | Escopo | Pode |
|---|---|---|
| **ADMINISTRADOR** | Rede municipal (global) | Criar escolas/tenants, ver e administrar todas |
| **ADMIN_ESCOLA** | Apenas a sua escola | Gerenciar usuários, cadastros, auditoria e relatórios do seu tenant |
| GESTOR_ESCOLAR / SECRETARIO / COORDENADOR | Apenas a sua escola | Operar conforme suas permissões |
| MERENDEIRA | Apenas Merenda da sua escola | — |
| ASSISTENTE_ALUNO | Apenas Materiais da sua escola | — |

### Criando uma escola (tenant)

Em **Administração → Escolas → + Nova escola** (somente o administrador da rede), informe o
nome, o código e os usuários iniciais. A operação é transacional e cria de uma vez:

- a escola, com estoque próprio e isolado;
- o **Administrador da Escola** (obrigatório) e, opcionalmente, Gestor, Secretário, Merendeira
  e Assistente de Aluno — todos vinculados **somente** a essa escola;
- categorias, unidades de medida e o parâmetro de validade padrão.

Também disponível por API: `POST /api/schools` com a lista `users`.

### Garantias de isolamento

- Toda consulta aplica o escopo de escola no servidor; só o administrador da rede consulta sem
  restrição.
- Um administrador de escola **não pode** criar administradores (da rede ou de outra escola),
  nem vincular usuários a outra escola — bloqueio de escalonamento de privilégio.
- Códigos de item (`MER-`/`MAT-`) são únicos globalmente, mesmo entre escolas diferentes.

## Usuários de desenvolvimento

Criados pelo `npm run seed` — senha padrão **`Admin@123`**:

| E-mail | Perfil | Acesso |
|---|---|---|
| `admin@escola.dev` | Administrador | Total (todas as escolas e módulos) |
| `gestor@escola.dev` | Gestor Escolar | Consulta, relatórios, revisão de ajustes |
| `secretario@escola.dev` | Secretário | Cadastros e movimentações |
| `merendeira@escola.dev` | Merendeira | **Somente Merenda** |
| `assistente@escola.dev` | Assistente de Aluno | **Somente Materiais** |

> A senha padrão vale apenas para desenvolvimento. Em produção, defina `SESSION_SECRET` forte
> e troque as senhas iniciais.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução em produção |
| `npm run typecheck` | Verificação de tipos (TypeScript estrito) |
| `npm run lint` | ESLint |
| `npm test` | Testes das regras críticas (Vitest) |
| `npm run seed` | Popula perfis, permissões, usuários e dados demo |
| `npx prisma migrate deploy` | Aplica as migrations |

## Arquitetura

Organização **modular por domínio**:

```
src/
├── app/                    # Rotas (UI) e API (Route Handlers)
│   ├── (app)/              # Área autenticada com sidebar dinâmica
│   ├── login/
│   └── api/                # auth, movements, items, food-batches, audit
├── modules/                # Domínios (regras de negócio, sem I/O de UI)
│   ├── auth/               # sessão e hash de senha
│   ├── catalogo/           # itens, características, códigos
│   ├── movimentacoes/      # SERVIÇO CENTRAL de movimentação
│   ├── lotes/              # lotes, FEFO, validade
│   ├── auditoria/          # AuditLog independente
│   ├── dashboard/          # consultas agregadas
│   └── shared/             # enums e navegação
├── server/                 # rbac, guard, transações/row lock
├── components/             # componentes reutilizáveis
└── lib/                    # prisma, erros, datas, http
```

### Regras invioláveis

1. **Nenhuma UI altera saldo diretamente** — tudo passa por
   `src/modules/movimentacoes/movement-service.ts`, dentro de transação PostgreSQL com
   `SELECT … FOR UPDATE`.
2. **Estoque nunca fica negativo** — validado no domínio e no banco.
3. **Movimentações e auditoria são imutáveis** — correções ocorrem por movimentação
   compensatória.
4. **Autorização é sempre verificada no servidor** — a sidebar apenas oculta o que o
   usuário não pode ver; o acesso direto por URL é bloqueado.
5. **Toda consulta respeita a escola do usuário** — Administrador tem acesso global.
6. **Alimentos usam FEFO** — a saída consome primeiro o lote que vence antes.

## Testes

```bash
npm test
```

Cobrem as regras críticas: saldo não-negativo, direção de movimentação, justificativa
obrigatória, FEFO (inclusive multi-lote), RBAC e isolamento por módulo/escola, geração e
imutabilidade de código, alertas de validade e normalização de datas.

## Documentação do projeto

Especificação, plano, modelo de dados e contratos em
[`specs/001-controle-estoque-escolar/`](specs/001-controle-estoque-escolar/), e os princípios
do projeto em [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
