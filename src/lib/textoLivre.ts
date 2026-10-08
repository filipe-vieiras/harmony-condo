// Texto livre que vira público (motivo da interdição, avisos do Zelador): tira os caracteres invisíveis e os de direção
// (U+200B a U+200F, U+202A a U+202E, U+2066 a U+2069 e U+FEFF), que serviriam para esconder ou inverter texto na tela.
// O banco faz o mesmo (limpar_texto_livre, 0042). Sem dependências de runtime.
// Lista ampliada (revisão de segurança do livro): marca árabe U+061C, hífen suave U+00AD, U+2060 a U+206F, tags U+E0000 a U+E007F,
// preenchimentos de Hangul/Khmer, seletores mongóis, controles C0/C1 (menos tab e quebra de linha). Espelha limpar_texto_livre (0043).
const INVISIVEIS = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u206A-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB]|[\u{E0000}-\u{E007F}]/gu;

/**
 * Nome "em branco": só espaço, tab, quebra de linha, NBSP, caracteres de controle e invisíveis de formato (categoria Cf: largura
 * zero, direção, WORD JOINER, soft hyphen, tags...). O banco enumera a mesma classe (pending_invites_nome_nao_vazio).
 */
export const textoVazio = (t: string | null | undefined): boolean => (t ?? '').replace(/[\p{Cc}\p{Cf}\s\u00A0\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180D\u2800\u3164\uFFA0\uFE00-\uFE0F]/gu, '') === '';

export const limparTextoLivre = (t: string): string => t.replace(INVISIVEIS, '');
