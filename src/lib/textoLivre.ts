// Texto livre que vira público (motivo da interdição, avisos do Zelador): tira os caracteres invisíveis e os de direção
// (U+200B a U+200F, U+202A a U+202E, U+2066 a U+2069 e U+FEFF), que serviriam para esconder ou inverter texto na tela.
// O banco faz o mesmo (limpar_texto_livre, 0042). Sem dependências de runtime.
const INVISIVEIS = /[​-‏‪-‮⁦-⁩﻿]/g;

/**
 * Nome "em branco": só espaço, tab, quebra de linha, NBSP, caracteres de controle e invisíveis de formato (categoria Cf: largura
 * zero, direção, WORD JOINER, soft hyphen, tags...). O banco enumera a mesma classe (pending_invites_nome_nao_vazio).
 */
export const textoVazio = (t: string | null | undefined): boolean => (t ?? '').replace(/[\p{Cc}\p{Cf}\s\u00A0\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180D\u2800\u3164\uFFA0]/gu, '') === '';

export const limparTextoLivre = (t: string): string => t.replace(INVISIVEIS, '');
