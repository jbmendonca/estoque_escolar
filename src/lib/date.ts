// Datas "somente data" (validade, fabricação) são gravadas à meia-noite UTC.
// Formatá-las com o fuso local desloca o dia (ex.: 15/09 vira 14/09 em UTC-3),
// o que é inaceitável para controle de validade de alimentos.
// Estas funções sempre formatam/interpretam em UTC.

/** Formata uma data-only como dd/MM/yyyy, sem deslocamento de fuso. */
export function formatDateOnly(date: Date): string {
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Formata data e hora de um evento (movimentação/auditoria) no fuso local. */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR');
}

/** Converte "YYYY-MM-DD" em Date à meia-noite UTC (sem deslocar o dia). */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
