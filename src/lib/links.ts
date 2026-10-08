/**
 * Link externo só vale se for http(s) sem espaço: `javascript:` e `data:` num href executariam código ao toque.
 * Devolve o endereço limpo ou null. O banco recusa o mesmo (url_http_valida, 0047).
 */
export function urlHttpSegura(valor: string | null | undefined): string | null {
  const v = (valor ?? '').trim();
  if (!/^https?:\/\/[^\s]+$/i.test(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}
