// Link de primeiro acesso / redefinição de senha.
//
// O action_link que o Supabase devolve (…/auth/v1/verify?token=…) é de USO
// ÚNICO e é consumido por qualquer coisa que o abra: o robô de pré-visualização
// do WhatsApp/Telegram ao colar o link numa conversa, antivírus de e-mail, ou
// o próprio síndico testando. Quando o morador toca, o token já foi gasto e ele
// vê "Link inválido ou expirado" — o convite do síndico foi consumido 10
// segundos depois de gerado.
//
// Solução padrão do Supabase para isso: mandar a pessoa para a NOSSA página
// com o token_hash, e só gastar o token quando ela toca em "Continuar"
// (verifyOtp no navegador). Robôs só leem a página; não tocam no botão.

export type TipoLinkAcesso = 'invite' | 'recovery';

export const TIPOS_LINK_ACESSO: TipoLinkAcesso[] = ['invite', 'recovery'];

export function ehTipoLinkAcesso(valor: string | null | undefined): valor is TipoLinkAcesso {
  return !!valor && (TIPOS_LINK_ACESSO as string[]).includes(valor);
}

export function montarLinkAcesso(
  origin: string,
  props: { action_link: string; hashed_token?: string; verification_type?: string },
): string {
  if (!props.hashed_token || !ehTipoLinkAcesso(props.verification_type)) {
    // Sem os dados para o link novo: cai no link padrão do Supabase.
    return props.action_link;
  }
  const base = origin.replace(/\/+$/, '');
  const query = new URLSearchParams({ token_hash: props.hashed_token, type: props.verification_type });
  return `${base}/definir-senha?${query.toString()}`;
}
