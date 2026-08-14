# Quickstart — Sistema de Controle de Estoque Escolar

Guia para subir o ambiente e **validar** que o MVP funciona ponta-a-ponta. Detalhes de implementação
ficam em `tasks.md` (Phase 2) e no código.

## Pré-requisitos

- Node.js 20 LTS + npm
- Docker + Docker Compose
- Porta 5432 (PostgreSQL) e 3000 (app) livres

## 1. Configuração

```bash
cp .env.example .env
# Edite .env se necessário. Nunca comite segredos reais.
```

Variáveis esperadas em `.env.example` (valores de exemplo, sem segredos reais):
`DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV`, `NEAR_EXPIRY_DAYS_DEFAULT`.

## 2. Subir o banco (Docker)

```bash
docker compose up -d db
```

## 3. Instalar, migrar e semear

```bash
npm install
npx prisma migrate dev
npm run seed
```

O **seed** cria: perfis padrão (ADMINISTRADOR, GESTOR_ESCOLAR, SECRETARIO, COORDENADOR, MERENDEIRA,
ASSISTENTE_ALUNO), permissões padrão, um **usuário admin de desenvolvimento**, uma **escola de
demonstração**, categorias e unidades de medida iniciais.

## 4. Rodar a aplicação

```bash
npm run dev
# App em http://localhost:3000
```

## 5. Roteiro de validação (fluxos críticos do MVP)

Faça login com o admin de desenvolvimento e valide, na ordem de prioridade da spec:

### V1 — Movimentação com rastreabilidade e saldo não-negativo (US1 / P1)
1. Cadastre um material (`Materiais → Estoque → Novo`). Confirme código gerado `MAT-000001`.
2. Registre uma **entrada** de 50 → saldo 50; abra a movimentação e confira saldo anterior 0 / posterior 50.
3. Registre uma **saída** de 20 → saldo 30, com usuário e data/hora.
4. Tente uma **saída de 100** → deve ser **bloqueada** (saldo não pode ficar negativo).
5. Confirme que existe um registro de **auditoria** da movimentação.

### V2 — RBAC e escopo por escola (US2 / P1)
1. Crie um usuário **Merendeira** vinculado à escola demo.
2. Faça login como Merendeira → a sidebar mostra **apenas Merenda**; Materiais e Usuários ausentes.
3. Tente acessar diretamente uma rota de Materiais/admin → **403** no backend.

### V3 — Merenda com lote/validade e FEFO (US3 / P1)
1. Cadastre um alimento; registre **duas entradas**: lote L1 (validade mais distante) e L2 (validade
   mais próxima).
2. Registre uma **saída**: o sistema deve sugerir **L2 primeiro** (FEFO).
3. Ajuste `nearExpiryDays` em `Cadastros/Config`; verifique alertas de **próximo do vencimento** e
   **vencido** no dashboard.

### V4 — Ajuste com revisão posterior (clarificação)
1. Faça um **ajuste** de saldo com justificativa → saldo muda na hora.
2. Confirme que foi criada uma **notificação de revisão** ao Gestor e um `AuditLog(ADJUSTMENT)`.
3. Como Gestor, marque como **revisado** → gera `AuditLog(ADJUSTMENT_REVIEW)`; saldo permanece.

### V5 — Listagem server-side (US4/US7)
1. Abra a tabela de estoque: confirme **ordenação alfabética por padrão**, busca, filtros, paginação e
   ordenação — todos aplicados no servidor (a resposta traz `total`/`totalPages`).

### V6 — Inventário e relatórios (US7/US8 / P3)
1. Crie uma conferência, informe quantidade física divergente com justificativa e **feche**: confirme
   geração de movimentação de **AJUSTE** + auditoria.
2. Gere um **relatório de movimentações** filtrado por período e **exporte** em CSV/XLSX.

## 6. Testes

```bash
npm run test        # unit (FEFO, saldo não-negativo, geração de código, policy RBAC)
npm run test:int    # integração (serviço de movimentação: transação/concorrência, escopo de escola)
npm run lint        # ESLint + Prettier
```

## Critérios de aceite do quickstart

- Nenhuma operação produz saldo negativo (V1.4).
- Perfis só enxergam/executam o que lhes é permitido, validado no backend (V2).
- Saída de merenda sempre sugere o lote de menor validade (V3.2).
- Ajustes efetivam na hora e geram notificação/auditoria de revisão (V4).
- Listas ordenam/filtram/paginam no servidor, alfabético por padrão (V5).
- Referências: [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [plan.md](plan.md).
