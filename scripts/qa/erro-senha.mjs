// Mapeamento de erro da tela /definir-senha (função pura, sem banco). Rode: node scripts/qa/erro-senha.mjs
import assert from 'node:assert/strict';
import { mensagemErroSenha, MSG_LINK_EXPIRADO } from '../../src/lib/erroSenha.ts';

const casos = [
  [{ code: 'same_password', name: 'AuthApiError', status: 422 }, 'A nova senha precisa ser diferente da atual.'],
  [{ code: 'weak_password', name: 'AuthWeakPasswordError', status: 422 }, 'Escolha uma senha mais forte (misture letras, números e um símbolo).'],
  [{ name: 'AuthSessionMissingError', status: 400 }, MSG_LINK_EXPIRADO],
  [{ code: 'session_not_found', status: 403 }, MSG_LINK_EXPIRADO],
  [{ code: 'refresh_token_not_found', status: 400 }, MSG_LINK_EXPIRADO],
  [{ code: 'over_request_rate_limit', status: 429 }, 'Muitas tentativas. Aguarde um minuto e tente de novo.'],
  [{ name: 'AuthRetryableFetchError', status: 0 }, 'Sem conexão. Verifique a internet e tente de novo.'],
  [{ code: 'unexpected_failure', status: 500, message: 'texto cru' }, 'Não foi possível salvar a senha. Tente de novo; se continuar, peça um novo link.'],
  [null, 'Não foi possível salvar a senha. Tente de novo; se continuar, peça um novo link.'],
];
for (const [erro, esperado] of casos) assert.equal(mensagemErroSenha(erro), esperado, JSON.stringify(erro));
assert.ok(!casos.some(([e]) => mensagemErroSenha(e).includes('texto cru')));
console.log(`erro-senha: ${casos.length} casos ok`);
