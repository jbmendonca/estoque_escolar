# Feature Specification: Sistema de Controle de Estoque Escolar

**Feature Branch**: `001-controle-estoque-escolar`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: Sistema Web de Controle de Estoque Escolar para gerenciamento de Merenda Escolar e Materiais Escolares, com controle individual por escola, perfis de acesso, movimentações rastreáveis, FEFO para alimentos, dashboard, relatórios, inventário e auditoria.

## Clarifications

### Session 2026-08-14

- Q: Como os itens se relacionam com as escolas (tabela global ou por escola)? → A: Catálogo por escola — cada escola cadastra e mantém seus próprios itens; o código único é global; sem compartilhamento de itens entre escolas.
- Q: A movimentação "transferência" deve mover estoque entre escolas no MVP? → A: Não — no MVP "transferência" ocorre apenas entre locais/prateleiras da MESMA escola; transferência entre escolas está fora do escopo desta versão.
- Q: Como identificar um lote de alimento (chave de unicidade)? → A: Lote = produto + número do lote + data de validade, por escola; entradas com mesmo número e mesma validade somam no lote existente; validades diferentes geram lotes diferentes.
- Q: Ajustes de estoque exigem aprovação antes de efetivar? → A: Não — o ajuste efetiva imediatamente (justificativa obrigatória + auditoria), é marcado como "pendente de revisão" e o Gestor da escola é notificado para revisão posterior, podendo marcá-lo como revisado.

## User Scenarios & Testing *(mandatory)*

<!-- Histórias priorizadas como jornadas de usuário; cada uma é testável de forma independente. -->

### User Story 1 - Registrar movimentações de estoque com rastreabilidade (Priority: P1)

Um servidor da escola (Secretário, Merendeira ou Assistente de Aluno) registra entradas e saídas
de itens. Cada movimentação atualiza o saldo do item e grava quem fez, quando, o tipo, a quantidade,
o saldo anterior e o saldo resultante. O sistema impede que o saldo fique negativo e, para perdas,
exige justificativa.

**Why this priority**: É o coração do sistema. Sem movimentação rastreável e saldo correto, nenhum
outro módulo (dashboard, relatórios, inventário) tem valor. Entrega, sozinha, um controle de estoque
funcional e auditável.

**Independent Test**: Cadastrar um item, registrar uma entrada e uma saída, e verificar que o saldo
evolui corretamente, que uma saída maior que o saldo é bloqueada, e que cada movimentação exibe
usuário, data/hora, tipo, saldo anterior e saldo posterior.

**Acceptance Scenarios**:

1. **Given** um item com saldo 0, **When** o usuário registra uma entrada de 50 unidades, **Then** o
   saldo passa a 50 e é criada uma movimentação com saldo anterior 0 e saldo posterior 50.
2. **Given** um item com saldo 50, **When** o usuário registra uma saída de 20, **Then** o saldo passa
   a 30 e a movimentação registra usuário, data, hora e tipo "saída".
3. **Given** um item com saldo 10, **When** o usuário tenta registrar uma saída de 15, **Then** o
   sistema rejeita a operação e informa que o estoque não pode ficar negativo.
4. **Given** uma saída do tipo "perda", **When** o usuário não informa justificativa, **Then** o
   sistema impede a conclusão até que a justificativa seja preenchida.
5. **Given** qualquer movimentação registrada, **When** ela é gravada, **Then** um registro de
   auditoria correspondente é criado e não pode ser editado nem excluído.

---

### User Story 2 - Controle de acesso por perfil e por escola (RBAC) (Priority: P1)

Cada usuário acessa apenas as funcionalidades e escolas permitidas ao seu perfil. A Merendeira só vê
Merenda; o Assistente de Aluno só vê Materiais; o Gestor Escolar vê apenas suas escolas; o
Administrador vê tudo. O menu esconde automaticamente as opções não autorizadas e o servidor bloqueia
acessos indevidos mesmo por acesso direto.

**Why this priority**: Requisito legal/institucional inegociável (constituição, Princípios III e V).
Movimentações e dados só têm valor se o acesso for controlado e segregado por escola.

**Independent Test**: Autenticar com cada perfil e verificar que o menu exibe somente os itens
autorizados e que tentativas de acessar funções/escolas fora do escopo são negadas.

**Acceptance Scenarios**:

1. **Given** um usuário Merendeira autenticado, **When** ele acessa o sistema, **Then** o menu exibe
   apenas o módulo Merenda Escolar e nega acesso a Materiais e à gestão de usuários.
2. **Given** um Gestor Escolar vinculado à Escola A, **When** ele tenta visualizar o estoque da Escola
   B, **Then** o sistema nega o acesso.
3. **Given** um usuário sem permissão para uma função, **When** ele tenta acessá-la diretamente, **Then**
   o sistema recusa a operação no servidor, não apenas ocultando o item no menu.
4. **Given** um Administrador, **When** ele acessa qualquer módulo ou escola, **Then** o acesso é
   permitido.

---

### User Story 3 - Merenda com lotes, validade e FEFO (Priority: P1)

A Merendeira e o Secretário registram entradas de alimentos por lote (com data de validade) e o saldo
é controlado por produto e por lote. Ao registrar uma saída, o sistema sugere prioritariamente os
lotes que vencem primeiro (FEFO). O sistema emite alertas para estoque baixo/zerado, itens próximos do
vencimento e itens vencidos, com o limite de "próximo do vencimento" configurável.

**Why this priority**: Segurança alimentar dos estudantes e conformidade sanitária (constituição,
Princípio VI). Diferencia o módulo de Merenda de um controle de estoque genérico.

**Independent Test**: Cadastrar um alimento, dar entrada em dois lotes com validades diferentes,
registrar uma saída e confirmar que o lote de menor validade é sugerido primeiro; ajustar o parâmetro
de dias e verificar os alertas de vencimento.

**Acceptance Scenarios**:

1. **Given** um alimento com o lote L1 (validade 30/09) e o lote L2 (validade 15/09), **When** o
   usuário registra uma saída, **Then** o sistema sugere primeiro o lote L2 (vence antes).
2. **Given** um alimento com saldo total abaixo do estoque mínimo, **When** o dashboard/alertas são
   consultados, **Then** o item aparece como "estoque abaixo do mínimo".
3. **Given** o parâmetro "próximo do vencimento" configurado em 7 dias, **When** um lote vence em 5
   dias, **Then** ele é sinalizado como "próximo do vencimento".
4. **Given** um lote já vencido, **When** os alertas são consultados, **Then** o lote aparece como
   "vencido".

---

### User Story 4 - Cadastro de itens com características variáveis e código único (Priority: P2)

O Secretário cadastra produtos (merenda) e materiais com atributos fixos e um conjunto de
características variáveis (ex.: Marca, Cor, Tamanho, Gramatura) sem exigir mudança na estrutura do
banco para cada novo tipo de característica. Cada item recebe um código interno único e imutável após
a primeira movimentação (padrão MER-000001 / MAT-000001). As listas são exibidas em ordem alfabética.

**Why this priority**: Base cadastral necessária para movimentar, mas o controle de movimentação (P1)
pode ser demonstrado com poucos itens. A flexibilidade de características evita retrabalho estrutural.

**Independent Test**: Cadastrar dois materiais com conjuntos de características diferentes, confirmar
que ambos convivem sem alteração de estrutura, que recebem códigos únicos sequenciais e que aparecem
em ordem alfabética; após uma movimentação, confirmar que o código não pode ser alterado.

**Acceptance Scenarios**:

1. **Given** um novo material, **When** o usuário adiciona características "Marca: Faber-Castell, Cor:
   Azul, Tamanho: A4", **Then** o item é salvo com essas características sem alteração de estrutura.
2. **Given** outro material com "Tipo: Caderno, Folhas: 200", **When** salvo, **Then** ambos coexistem
   com conjuntos de características distintos.
3. **Given** o cadastro de um novo material, **When** ele é criado, **Then** recebe um código único no
   padrão MAT-NNNNNN, distinto de qualquer código já usado (não reutilizável).
4. **Given** um item que já possui movimentação, **When** o usuário tenta alterar seu código, **Then**
   o sistema impede a alteração.
5. **Given** a lista de materiais, **When** ela é exibida sem filtro, **Then** os itens aparecem em
   ordem alfabética por nome.

---

### User Story 5 - Distribuição de materiais escolares (Priority: P2)

O Assistente de Aluno registra a distribuição/saída de materiais podendo indicar opcionalmente o
destino (aluno, turma, professor, setor, atividade ou outro), sem exigir cadastro completo de alunos.
Devoluções, perdas, avarias, transferências e ajustes também são suportados.

**Why this priority**: Cobre a operação diária do módulo de Materiais, agregando valor após o núcleo
de movimentação estar pronto.

**Independent Test**: Registrar uma distribuição informando "Turma 5º A" como destino e confirmar que o
saldo diminui e a movimentação guarda o destino; registrar uma devolução e confirmar o retorno ao
saldo.

**Acceptance Scenarios**:

1. **Given** um material com saldo 100, **When** o usuário registra distribuição de 10 para a turma
   "5º A", **Then** o saldo passa a 90 e o destino é gravado na movimentação.
2. **Given** uma distribuição registrada, **When** o usuário registra uma devolução de 3, **Then** o
   saldo aumenta em 3 e a movimentação de devolução é registrada.
3. **Given** uma distribuição, **When** o usuário não informa destino, **Then** a operação é concluída
   normalmente (destino é opcional).

---

### User Story 6 - Dashboard e alertas por escola e permissão (Priority: P2)

Cada usuário vê um painel inicial com indicadores restritos à(s) sua(s) escola(s) e às suas
permissões: quantidade de produtos e materiais, itens com estoque baixo, itens sem estoque, alimentos
próximos do vencimento e vencidos, entradas e saídas recentes, movimentações do período, consumo de
merenda e distribuição de materiais.

**Why this priority**: Dá visão gerencial imediata, mas depende de dados de movimentação já existentes.

**Independent Test**: Autenticar com um Gestor de uma escola e confirmar que os números refletem apenas
aquela escola; autenticar com uma Merendeira e confirmar que só aparecem indicadores de Merenda.

**Acceptance Scenarios**:

1. **Given** um Gestor da Escola A, **When** ele abre o dashboard, **Then** os indicadores consideram
   somente dados da Escola A.
2. **Given** uma Merendeira, **When** ela abre o dashboard, **Then** apenas indicadores de Merenda são
   exibidos.
3. **Given** itens com saldo abaixo do mínimo, **When** o dashboard é carregado, **Then** o contador
   "estoque baixo" reflete esses itens.

---

### User Story 7 - Relatórios com filtros e exportação (Priority: P3)

Usuários com permissão geram relatórios (posição de estoque, inventário, entradas, saídas,
movimentações, consumo, perdas, vencidos, próximos do vencimento, abaixo do mínimo, distribuição,
por usuário, por escola, por período) com filtros por período, escola, produto, categoria e tipo de
movimentação, e exportam ao menos em PDF e Excel/CSV, sempre respeitando o escopo de escola do usuário.

**Why this priority**: Importante para prestação de contas, mas construído sobre os dados já gerados
pelas histórias anteriores.

**Independent Test**: Gerar um relatório de movimentações filtrado por período e escola, conferir os
totais contra as movimentações registradas e exportar em PDF e CSV.

**Acceptance Scenarios**:

1. **Given** movimentações em várias datas, **When** o usuário filtra por um período, **Then** o
   relatório mostra apenas as movimentações daquele intervalo.
2. **Given** um relatório gerado, **When** o usuário solicita exportação, **Then** o sistema produz o
   arquivo em PDF e em Excel/CSV.
3. **Given** um Gestor da Escola A, **When** ele gera qualquer relatório, **Then** os dados abrangem
   somente a Escola A.

---

### User Story 8 - Inventário / conferência de estoque (Priority: P3)

Usuários autorizados realizam conferência informando a quantidade registrada no sistema, a quantidade
encontrada fisicamente, a diferença e a justificativa. Ajustes decorrentes do inventário geram
movimentação de ajuste e registro de auditoria.

**Why this priority**: Garante a fidelidade do saldo ao longo do tempo; depende de itens e saldos já
existentes.

**Independent Test**: Iniciar uma conferência de um item, informar quantidade física diferente da
registrada com justificativa, confirmar o ajuste e verificar que houve movimentação de ajuste e
registro de auditoria.

**Acceptance Scenarios**:

1. **Given** um item com saldo 100 no sistema, **When** o usuário informa 95 encontrados e justifica,
   **Then** o sistema calcula a diferença de -5 e, ao confirmar, gera uma movimentação de ajuste que
   deixa o saldo em 95.
2. **Given** um ajuste de inventário confirmado, **When** ele é gravado, **Then** um registro de
   auditoria é criado com os valores anterior e posterior.

---

### User Story 9 - Administração: usuários, escolas, permissões e auditoria (Priority: P2)

O Administrador cadastra escolas, cria/edita/ativa/desativa usuários, configura permissões e consulta
a auditoria. Usuários e itens são inativados (não excluídos) quando possuem histórico.

**Why this priority**: Necessária para operar o sistema com múltiplos usuários e escolas; sustenta o
RBAC (P1) e a governança de dados.

**Independent Test**: Criar uma escola, criar um usuário Gestor vinculado a ela, desativar um usuário
com histórico e confirmar que ele é inativado (não removido), e consultar a auditoria dessas ações.

**Acceptance Scenarios**:

1. **Given** o Administrador, **When** ele cadastra uma escola e um usuário vinculado, **Then** o
   usuário passa a acessar somente aquela escola conforme seu perfil.
2. **Given** um usuário com movimentações associadas, **When** o Administrador tenta removê-lo, **Then**
   o sistema oferece inativação em vez de exclusão, preservando o histórico.
3. **Given** uma alteração de permissões, **When** ela é salva, **Then** um registro de auditoria é
   criado com os dados anteriores e posteriores.

---

### Edge Cases

- Tentativa de saída maior que o saldo do item ou do lote → operação rejeitada, sem saldo negativo.
- Duas saídas simultâneas do mesmo item/lote → o sistema garante que a soma não gere saldo negativo
  (operações concorrentes tratadas atomicamente).
- Saída de merenda quando o lote sugerido (FEFO) tem saldo insuficiente → o sistema orienta a
  completar com o próximo lote a vencer.
- Item vencido → não deve ser sugerido para consumo; sua baixa ocorre pelo tipo "produto vencido".
- Perda, avaria ou produto vencido sem justificativa → conclusão bloqueada.
- Tentativa de excluir item/usuário com histórico → oferecida inativação.
- Tentativa de alterar código de item já movimentado → bloqueada.
- Usuário vinculado a múltiplas escolas → precisa selecionar/visualizar a escola em contexto.
- Tentativa de "transferência" para outra escola → não permitida no MVP (transferência é interna).
- Ajuste efetivado → gera notificação de revisão ao Gestor sem bloquear o saldo já aplicado.
- Acesso direto a uma URL/função sem permissão → negado no servidor.
- Exportação de relatório muito grande → o sistema conclui a geração e disponibiliza o arquivo sem
  travar a interface.

## Requirements *(mandatory)*

### Functional Requirements

**Estrutura multi-escola e cadastros base**

- **FR-001**: O sistema MUST permitir cadastrar escolas e controlar o estoque de cada escola de forma
  independente.
- **FR-002**: O sistema MUST vincular todo item, saldo e movimentação a uma escola responsável.
- **FR-002a**: O catálogo de itens é por escola: cada escola cadastra e mantém seus próprios itens,
  sem compartilhamento de itens entre escolas. Um item pertence a exatamente uma escola.
- **FR-003**: O sistema MUST permitir cadastrar categorias, unidades de medida, prateleiras
  (localização física) e fornecedores.
- **FR-004**: O sistema MUST permitir cadastrar prateleiras com depósito/almoxarifado, estante,
  prateleira, posição e descrição (ex.: código do tipo ALM-01-A-01).

**Itens (merenda e materiais)**

- **FR-005**: O sistema MUST permitir cadastrar itens com: código único, nome, descrição, categoria,
  unidade de medida, código da prateleira, localização física, características, quantidade atual,
  estoque mínimo, situação (ativo/inativo), escola responsável, data de cadastro e usuário responsável
  pelo cadastro.
- **FR-006**: O sistema MUST permitir associar a cada item um conjunto de características variáveis
  (pares atributo/valor, ex.: Marca, Cor, Tamanho, Gramatura) sem exigir alteração de estrutura para
  novos tipos de característica.
- **FR-007**: O sistema MUST gerar automaticamente um código interno único por item, no padrão
  MER-NNNNNN para merenda e MAT-NNNNNN para materiais.
- **FR-008**: O sistema MUST garantir que códigos sejam únicos e não reutilizáveis, inclusive após
  inativação.
- **FR-009**: O sistema MUST impedir a alteração do código de um item após existir movimentação
  relacionada a ele.
- **FR-010**: O sistema MUST exibir listas de itens em ordem alfabética por nome por padrão.
- **FR-011**: O sistema MUST permitir pesquisar itens por nome, código, categoria, código de
  prateleira, característica e escola.
- **FR-012**: O sistema MUST permitir inativar itens em vez de excluí-los quando possuírem
  movimentações, preservando o histórico.

**Merenda: lotes, validade e FEFO**

- **FR-013**: O sistema MUST controlar o saldo de alimentos por produto e por lote.
- **FR-014**: O sistema MUST registrar, em cada entrada de alimento: produto, quantidade, lote, data de
  fabricação (quando disponível), data de validade, fornecedor, documento de entrada, data de
  recebimento, responsável e observações.
- **FR-015**: O sistema MUST permitir que um mesmo produto possua vários lotes simultaneamente.
- **FR-015a**: O sistema MUST identificar um lote pela combinação produto + número do lote + data de
  validade (dentro da mesma escola). Entradas com o mesmo número de lote E a mesma validade somam no
  lote existente; o mesmo número com validade diferente gera um lote distinto.
- **FR-016**: O sistema MUST, ao registrar saída de alimento, sugerir prioritariamente os lotes que
  vencem primeiro (FEFO — First Expire, First Out).
- **FR-017**: O sistema MUST emitir alertas de: estoque abaixo do mínimo, estoque zerado, produtos
  próximos do vencimento e produtos vencidos.
- **FR-018**: O sistema MUST permitir configurar a quantidade de dias considerada "próximo do
  vencimento".
- **FR-019**: O sistema MUST suportar os tipos de saída de merenda: consumo, preparo de merenda, perda,
  produto vencido, avaria, transferência e ajuste.

**Materiais escolares**

- **FR-020**: O sistema MUST suportar os tipos de movimentação de materiais: entrada, distribuição,
  saída, devolução, perda, avaria, transferência e ajuste.
- **FR-021**: O sistema MUST permitir, na distribuição de material, indicar opcionalmente o destino
  (aluno, turma, professor, setor, atividade ou outro) sem exigir cadastro completo de alunos.
- **FR-021a**: A movimentação do tipo "transferência" MUST ocorrer apenas entre locais/prateleiras da
  MESMA escola, sem alterar a escola responsável pelo item. Transferência de estoque entre escolas
  distintas está fora do escopo desta versão.

**Movimentações e integridade**

- **FR-022**: O sistema MUST registrar, em toda movimentação: número único, escola, módulo,
  produto/material, lote (quando aplicável), tipo, quantidade, saldo anterior, saldo posterior,
  usuário, data e hora, justificativa (quando necessária), observações e documento de referência
  (quando houver).
- **FR-023**: O sistema MUST impedir que qualquer operação resulte em estoque negativo (por item e por
  lote).
- **FR-024**: O sistema MUST exigir justificativa para movimentações de perda (e para avaria/produto
  vencido/ajuste conforme aplicável).
- **FR-024a**: Movimentações de ajuste MUST efetivar imediatamente o novo saldo (não há aprovação
  prévia); ao efetivar, o sistema MUST marcar o ajuste como "pendente de revisão" e notificar o Gestor
  da escola. O Gestor MUST poder marcar o ajuste como "revisado". A revisão é registrada em auditoria e
  NÃO altera o saldo já efetivado (eventual correção ocorre por nova movimentação).
- **FR-025**: O sistema MUST executar operações que alteram saldo de forma atômica, garantindo
  consistência mesmo sob acessos concorrentes.
- **FR-026**: O sistema MUST tratar registros de movimentação como imutáveis (não editáveis nem
  excluíveis); correções ocorrem por nova movimentação (ex.: ajuste).

**Perfis e controle de acesso (RBAC)**

- **FR-027**: O sistema MUST implementar os perfis Administrador, Gestor Escolar, Secretário,
  Coordenador, Merendeira e Assistente de Aluno, com as permissões descritas neste documento.
- **FR-028**: O sistema MUST restringir a Merendeira ao módulo de Merenda e o Assistente de Aluno ao
  módulo de Materiais, negando acesso à gestão de usuários.
- **FR-029**: O sistema MUST restringir Gestor, Secretário e Coordenador às escolas às quais estão
  vinculados.
- **FR-030**: O sistema MUST verificar autorização no servidor para cada operação, negando acessos não
  autorizados mesmo por acesso direto.
- **FR-031**: O sistema MUST ocultar automaticamente no menu as opções não autorizadas ao perfil.
- **FR-032**: O sistema MUST permitir ao Administrador cadastrar/editar/ativar/desativar usuários,
  cadastrar escolas, configurar permissões, acessar todos os estoques, realizar ajustes
  administrativos, visualizar todos os relatórios e acessar a auditoria.

**Dashboard**

- **FR-033**: O sistema MUST apresentar um dashboard com: quantidade de produtos e de materiais
  cadastrados, itens com estoque baixo, itens sem estoque, alimentos próximos do vencimento e vencidos,
  entradas e saídas recentes, movimentações do período, consumo de merenda e distribuição de materiais.
- **FR-034**: O sistema MUST restringir os indicadores do dashboard à(s) escola(s) e às permissões do
  usuário.

**Relatórios**

- **FR-035**: O sistema MUST oferecer relatórios de: posição atual do estoque, inventário, entradas,
  saídas, movimentações, consumo, perdas, produtos vencidos, produtos próximos do vencimento, estoque
  abaixo do mínimo, distribuição de materiais, movimentações por usuário, por escola e por período.
- **FR-036**: O sistema MUST permitir filtrar relatórios por período, escola, produto, categoria e tipo
  de movimentação.
- **FR-037**: O sistema MUST permitir exportar relatórios ao menos em PDF e Excel/CSV.
- **FR-038**: O sistema MUST restringir os dados de relatórios ao escopo de escola do usuário.

**Inventário**

- **FR-039**: O sistema MUST permitir conferência de estoque informando quantidade registrada,
  quantidade encontrada, diferença e justificativa.
- **FR-040**: O sistema MUST gerar movimentação de ajuste e registro de auditoria a partir de ajustes
  de inventário.

**Auditoria**

- **FR-041**: O sistema MUST registrar em auditoria as operações importantes: login, criação e
  alteração de usuário, criação e alteração de produto, movimentação, ajuste, revisão de ajuste,
  cancelamento e alteração de permissões.
- **FR-042**: O sistema MUST registrar em cada evento de auditoria: usuário, ação, recurso,
  identificador, data, hora e os dados relevantes anteriores e posteriores quando aplicável.
- **FR-043**: O sistema MUST tratar registros de auditoria como imutáveis.

**Experiência do usuário**

- **FR-044**: O sistema MUST apresentar a interface em português brasileiro com linguagem simples.
- **FR-045**: O sistema MUST oferecer um menu lateral com as seções Dashboard; Merenda Escolar
  (Estoque, Entradas, Saídas, Lotes e Validades, Inventário, Relatórios); Materiais Escolares (Estoque,
  Entradas, Distribuições/Saídas, Inventário, Relatórios); Cadastros (Categorias, Unidades de Medida,
  Prateleiras, Fornecedores); Administração (Escolas, Usuários, Permissões, Auditoria).
- **FR-046**: O sistema MUST ser responsivo e utilizável em computadores, tablets e celulares.
- **FR-047**: O sistema MUST tratar dados pessoais conforme os princípios da LGPD.

### Key Entities *(include if feature involves data)*

- **Escola**: unidade responsável por um estoque; a que todo item e movimentação está vinculado.
- **Usuário**: pessoa que opera o sistema; possui perfil, vínculo com uma ou mais escolas e situação
  ativo/inativo.
- **Perfil/Papel (RBAC)**: conjunto de permissões (Administrador, Gestor Escolar, Secretário,
  Coordenador, Merendeira, Assistente de Aluno).
- **Permissão**: autorização granular para acessar uma função/módulo.
- **Item**: produto de merenda ou material escolar; pertence a exatamente uma escola (catálogo por
  escola); atributos fixos + características variáveis, código único global, estoque mínimo, situação.
- **Característica**: par atributo/valor associado a um item (ex.: Marca: Faber-Castell).
- **Categoria** e **Unidade de Medida**: classificações de apoio ao cadastro de itens.
- **Prateleira/Localização**: local físico (depósito, estante, prateleira, posição).
- **Fornecedor**: origem das entradas de itens.
- **Lote**: unidade de controle de alimentos identificada por produto + número do lote + data de
  validade (por escola), com data de fabricação opcional e saldo próprio.
- **Saldo de Estoque**: quantidade atual por item (e por lote, na merenda) em uma escola.
- **Movimentação**: registro imutável de alteração de saldo (entrada, saída, distribuição, devolução,
  perda, avaria, produto vencido, transferência interna, ajuste), com saldo anterior/posterior,
  usuário, data/hora, justificativa e destino opcional. Ajustes carregam um estado de revisão
  ("pendente de revisão" / "revisado") que não afeta o saldo.
- **Notificação de Revisão**: aviso gerado ao Gestor da escola quando um ajuste é efetivado, para
  revisão posterior; guarda a movimentação de ajuste referenciada e a situação (pendente/revisado).
- **Inventário/Conferência**: comparação entre saldo do sistema e contagem física, com diferença e
  justificativa.
- **Registro de Auditoria**: evento imutável com usuário, ação, recurso, identificador, data/hora e
  dados anteriores/posteriores.
- **Alerta**: sinalização de estoque baixo/zerado, próximo do vencimento ou vencido.
- **Configuração**: parâmetros como dias para "próximo do vencimento".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das movimentações registram usuário, data/hora, tipo, saldo anterior e saldo
  posterior.
- **SC-002**: 0 ocorrências de saldo negativo, por item e por lote, em qualquer operação.
- **SC-003**: 100% das tentativas de acesso a funções/escolas não autorizadas são negadas.
- **SC-004**: Em saídas de merenda, o lote sugerido é o de menor validade disponível em 100% dos casos
  (FEFO).
- **SC-005**: Um servidor consegue registrar uma entrada ou saída simples em menos de 1 minuto após o
  login.
- **SC-006**: 100% das operações importantes (login, cadastros, movimentações, ajustes, alterações de
  permissão) geram registro de auditoria consultável.
- **SC-007**: 100% dos itens com saldo abaixo do mínimo, sem saldo, próximos do vencimento ou vencidos
  aparecem nos alertas/dashboard correspondentes.
- **SC-008**: Relatórios podem ser exportados em PDF e Excel/CSV em 100% dos tipos oferecidos.
- **SC-009**: A interface é utilizável em telas de celular, tablet e computador nos fluxos principais
  (cadastro, entrada, saída, consulta).
- **SC-010**: 90% dos usuários de uma escola concluem uma movimentação sem erro na primeira tentativa.
- **SC-011**: Nenhum registro de movimentação ou auditoria pode ser editado ou excluído (0 exclusões
  permitidas).
- **SC-012**: 100% dos ajustes de estoque geram notificação de revisão ao Gestor da escola e podem ser
  marcados como revisados, sem alterar o saldo já efetivado.

## Assumptions

- O sistema é uma aplicação web acessada por navegador, sem necessidade de instalação local.
- O catálogo de itens é por escola (sem compartilhamento entre escolas); o código único é global.
- Transferência entre escolas está fora do escopo desta versão (transferência é interna à escola).
- Lote é identificado por produto + número do lote + validade, dentro da mesma escola.
- Ajustes efetivam na hora e são revisados posteriormente pelo Gestor (sem workflow de aprovação prévia).
- A autenticação usa usuário e senha individuais por servidor da escola; SSO fica fora do escopo desta
  versão.
- Um usuário pode estar vinculado a uma ou mais escolas; o Administrador atua sobre todas.
- Não é exigido cadastro completo de alunos para o funcionamento do estoque; destinos de distribuição
  são texto/opção livre.
- Categorias, unidades de medida, prateleiras e fornecedores são cadastrados antes de serem usados nos
  itens (ou criados durante o cadastro).
- "Cancelamento" de movimentação, quando permitido, ocorre por movimentação compensatória, preservando
  o histórico (nenhum registro é apagado).
- A moeda/valores financeiros não fazem parte do escopo desta versão (o foco é quantidade/estoque).
- Os relatórios exportados refletem exatamente os dados filtrados no momento da geração.
- O idioma da versão inicial é exclusivamente português brasileiro.
