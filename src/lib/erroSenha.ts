// Traduz o erro do supabase.auth.updateUser({ password }) para uma frase simples.
// Antes, todo erro virava "o link pode ter expirado" e enganava quem só repetiu a senha atual.
// Nunca devolve o texto cru do erro (vem em inglês e pode expor detalhe interno).

type ErroAuth = { code?: string; name?: string; status?: number } | null | undefined;

export const MSG_LINK_EXPIRADO =
  'Não foi possível salvar a senha. O link pode ter expirado — solicite um novo convite ou uma nova redefinição de senha.';

// Códigos do auth-js que significam "não há sessão válida" — a única situação em que o link realmente venceu.
const CODIGOS_SEM_SESSAO = ['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt', 'user_not_found'];

export function mensagemErroSenha(erro: ErroAuth): string {
  const codigo = erro?.code;
  if (codigo === 'same_password') return 'A nova senha precisa ser diferente da atual.';
  // As "reasons" do weak_password vêm em inglês/técnicas; a frase fixa é mais clara.
  if (codigo === 'weak_password') return 'Escolha uma senha mais forte (misture letras, números e um símbolo).';
  if (codigo === 'over_request_rate_limit' || codigo === 'over_email_send_rate_limit' || erro?.status === 429) {
    return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  }
  // Sem internet o auth-js devolve AuthRetryableFetchError (status 0, sem code).
  if (erro?.name === 'AuthRetryableFetchError' || erro?.status === 0) {
    return 'Sem conexão. Verifique a internet e tente de novo.';
  }
  // AuthSessionMissingError não traz code: identificamos pelo nome.
  if (erro?.name === 'AuthSessionMissingError' || (codigo && CODIGOS_SEM_SESSAO.includes(codigo))) {
    return MSG_LINK_EXPIRADO;
  }
  return 'Não foi possível salvar a senha. Tente de novo; se continuar, peça um novo link.';
}
