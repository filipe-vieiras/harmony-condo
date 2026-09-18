import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // A rota de callback (convite, redefinição de senha, magic link) precisa
  // rodar mesmo sem sessão ainda — é ela quem troca o código pela sessão.
  // Bloqueá-la aqui impede qualquer convite ou reset de senha de funcionar.
  if (request.nextUrl.pathname.startsWith('/api/auth/callback')) {
    return supabaseResponse;
  }

  // Mantém a sessão JWT atualizada em todas as requisições
  const { data: { user } } = await supabase.auth.getUser();

  // Rotas protegidas: redireciona para /login se não autenticado
  const isPublicPath = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/definir-senha';
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Já autenticado tentando acessar /login → redireciona para home
  // (/definir-senha fica de fora: é exatamente lá que o usuário chega logado
  // pela primeira vez, e precisa poder ficar na página pra criar a senha).
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
