import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Só aceita caminho interno ("/multas/1"). Bloqueia "//site", "/\site" e
// "@site" — concatenados à origem, levariam o usuário para outro domínio.
function destinoSeguro(next: string | null): string {
  if (!next || !/^\/[^/\\]/.test(next) && next !== '/') return '/';
  return next;
}

// Callback para reset de senha e magic link do Supabase Auth
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = destinoSeguro(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
