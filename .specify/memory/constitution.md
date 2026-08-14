<!--
SYNC IMPACT REPORT
==================
Versão: (template inicial não versionado) → 1.0.0
Tipo de bump: MAJOR (ratificação inicial — substituição de todos os placeholders do template)

Princípios definidos (7, cobrindo os 20 requisitos obrigatórios do projeto):
  I.   Simplicidade e Usabilidade para o Servidor Público (req. 1, 2-uso, 10, 11)
  II.  Rastreabilidade e Auditoria das Movimentações (req. 2-rastreabilidade, 3, 6, 13, 18)
  III. Segurança e Controle de Acesso (RBAC + LGPD) (req. 2-segurança, 4, 5, 17)
  IV.  Integridade dos Dados de Estoque (req. 7, 8, 9, 12)
  V.   Arquitetura Multi-Escola (req. 19, 20)
  VI.  Controle de Lote e Validade da Merenda (req. 14)
  VII. Qualidade de Código, Tipagem e Testes (req. 15, 16)

Seções adicionais:
  + Restrições Adicionais e Padrões Técnicos
  + Fluxo de Desenvolvimento e Portões de Qualidade
  + Governança

Templates verificados quanto à consistência:
  ✅ .specify/templates/plan-template.md  (Constitution Check é genérico; lê este arquivo — sem alteração necessária)
  ✅ .specify/templates/spec-template.md  (sem referências à constituição — sem alteração necessária)
  ✅ .specify/templates/tasks-template.md (sem referências à constituição — sem alteração necessária)
  ✅ .specify/templates/checklist-template.md (genérico — sem alteração necessária)

TODOs diferidos: nenhum.
-->

# Sistema de Controle de Estoque Escolar — Constituição

Este documento estabelece os princípios inegociáveis do projeto. Toda especificação, plano,
tarefa e implementação DEVE estar em conformidade com ele. Em caso de conflito, esta
constituição prevalece sobre qualquer outra prática ou decisão técnica.

## Princípios Fundamentais

### I. Simplicidade e Usabilidade para o Servidor Público

O sistema DEVE ser simples, intuitivo e adequado para servidores de escolas públicas, sem
exigir conhecimento técnico prévio.

- As interfaces DEVEM ser responsivas e acessíveis, seguindo boas práticas de acessibilidade
  (alvo mínimo: WCAG 2.1 AA para fluxos principais).
- Toda a linguagem visível ao usuário DEVE estar em português brasileiro claro, evitando
  jargão técnico.
- Listas de produtos e materiais DEVEM usar ordenação alfabética por padrão.
- Fluxos críticos (entrada, saída, ajuste) DEVEM ser realizáveis com o menor número possível
  de passos e com mensagens de erro compreensíveis.

**Justificativa:** o público-alvo tem baixa tolerância a complexidade; usabilidade e clareza
reduzem erros operacionais e retrabalho no controle de estoque.

### II. Rastreabilidade e Auditoria das Movimentações (INEGOCIÁVEL)

Nenhuma movimentação de estoque pode existir sem registro rastreável e imutável.

- Toda movimentação DEVE registrar: usuário responsável, data, hora, tipo de movimentação,
  quantidade anterior, quantidade movimentada e quantidade resultante.
- O sistema DEVE manter histórico completo de entradas, saídas, perdas, ajustes e
  transferências.
- As principais operações DEVEM gerar registros de auditoria (quem, o quê, quando, antes/depois).
- Registros de movimentação e auditoria são append-only: NÃO PODEM ser editados nem excluídos
  após criados. Correções ocorrem por nova movimentação compensatória.
- Toda alteração futura do sistema DEVE preservar a rastreabilidade e a integridade dos
  registros existentes.

**Justificativa:** o controle de recursos públicos exige prestação de contas e capacidade de
auditoria a qualquer momento; a integridade histórica é um requisito legal e institucional.

### III. Segurança e Controle de Acesso — RBAC e LGPD (INEGOCIÁVEL)

Acesso é negado por padrão; cada usuário só faz o que seu papel autoriza.

- O controle de acesso DEVE ser baseado em papéis e permissões (RBAC).
- Nenhum usuário PODE acessar funcionalidade para a qual não possua autorização explícita.
- A autorização DEVE ser verificada no servidor (backend), nunca apenas na interface.
- Dados pessoais DEVEM ser tratados conforme os princípios da LGPD: finalidade, necessidade,
  minimização, segurança e não retenção além do necessário.
- Credenciais e segredos NÃO PODEM ser versionados no repositório nem expostos em logs.

**Justificativa:** o sistema lida com patrimônio público e dados de pessoas; segurança e
conformidade legal são condições para operação, não melhorias opcionais.

### IV. Integridade dos Dados de Estoque (INEGOCIÁVEL)

O estado do estoque deve ser sempre consistente e verdadeiro.

- O estoque NUNCA PODE assumir quantidade negativa; qualquer operação que resultaria em saldo
  negativo DEVE ser rejeitada.
- Operações críticas (movimentações que alteram saldo, transferências, ajustes) DEVEM executar
  dentro de transações de banco de dados, garantindo atomicidade.
- Exclusão de registros que possuam movimentações DEVE ser evitada; preferir inativação com
  preservação de histórico.
- Códigos de identificação DEVEM ser únicos e não reutilizáveis, mesmo após inativação.

**Justificativa:** decisões de reposição e prestação de contas dependem de saldos corretos;
inconsistências corrompem todo o propósito do sistema.

### V. Arquitetura Multi-Escola (Multi-Tenant)

O sistema é projetado desde o início para uma ou várias escolas.

- A arquitetura DEVE suportar uma ou múltiplas escolas sem necessidade de reconstrução.
- Toda movimentação e todo saldo de estoque DEVEM estar vinculados à escola responsável.
- O isolamento de dados entre escolas DEVE ser garantido: nenhum usuário vê ou altera estoque
  de escola à qual não pertence, salvo papéis explicitamente inter-escolares.

**Justificativa:** evita reengenharia futura e permite escala do sistema para redes de ensino
mantendo a segregação correta de responsabilidades.

### VI. Controle de Lote e Validade da Merenda

Alimentos exigem rastreio adicional por lote e prazo.

- O módulo de merenda DEVE controlar lote e validade dos itens alimentícios.
- A saída de alimentos DEVE priorizar a lógica de vencimento (ex.: PEPS/FEFO — primeiro que
  vence, primeiro que sai).
- O sistema DEVE permitir identificar itens vencidos ou próximos do vencimento.

**Justificativa:** segurança alimentar dos estudantes e conformidade sanitária dependem do
controle rigoroso de validade e lote.

### VII. Qualidade de Código, Tipagem e Testes

Código sustentável é pré-requisito de rastreabilidade e integridade duradouras.

- O desenvolvimento DEVE priorizar código limpo, modular, tipado e testável.
- Regras de negócio importantes (saldo não negativo, cálculo de movimentação, RBAC, FEFO,
  isolamento por escola) DEVEM possuir testes automatizados.
- Uma regra de negócio crítica não é considerada concluída sem teste automatizado que a cubra.

**Justificativa:** garante que os princípios acima continuem válidos ao longo do tempo e que
mudanças futuras não quebrem invariantes essenciais.

## Restrições Adicionais e Padrões Técnicos

- **Idioma:** interface e mensagens ao usuário em português brasileiro; nomes de código podem
  seguir a convenção da linguagem adotada.
- **Persistência transacional:** o banco de dados escolhido DEVE suportar transações ACID para
  as operações críticas exigidas pelo Princípio IV.
- **Segredos e configuração:** DEVEM ser fornecidos por variáveis de ambiente ou cofre de
  segredos, nunca embutidos no código.
- **Registros imutáveis:** as tabelas de movimentação e auditoria DEVEM ser modeladas como
  append-only no nível da aplicação (sem UPDATE/DELETE de linhas históricas).
- **Acessibilidade e responsividade:** alvo mínimo WCAG 2.1 AA e suporte a telas pequenas para
  os fluxos principais.

## Fluxo de Desenvolvimento e Portões de Qualidade

- Toda funcionalidade nasce de uma especificação (`/speckit-specify`) e de um plano
  (`/speckit-plan`) alinhados a esta constituição.
- O **Constitution Check** do plano DEVE ser validado antes da implementação; violações
  precisam de justificativa explícita registrada.
- Nenhuma entrega que envolva movimentação de estoque, RBAC ou dados pessoais é aceita sem:
  1. testes automatizados das regras de negócio afetadas;
  2. verificação de autorização no backend;
  3. confirmação de que nenhum registro histórico é alterado ou removido.
- Revisões DEVEM verificar conformidade com os Princípios I–VII antes de aprovar.

## Governança

Esta constituição prevalece sobre todas as demais práticas do projeto.

- **Emendas:** qualquer alteração DEVE ser proposta por escrito, justificada, aprovada pelos
  responsáveis do projeto e acompanhada de plano de migração quando afetar dados existentes.
- **Versionamento (SemVer):**
  - MAJOR — remoção/redefinição incompatível de princípios ou governança;
  - MINOR — novo princípio/seção ou expansão material de regra;
  - PATCH — esclarecimentos, correções de redação, ajustes não semânticos.
- **Conformidade:** toda especificação, plano e revisão de código DEVE confirmar aderência aos
  princípios; desvios exigem justificativa aprovada e registrada.
- **Preservação histórica:** nenhuma emenda pode autorizar a perda de rastreabilidade ou
  integridade de registros já existentes (ver Princípios II e IV).

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
