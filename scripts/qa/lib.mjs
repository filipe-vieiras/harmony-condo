// Utilitários da bateria de QA (scripts/qa/bateria.mjs).
//
//   node scripts/qa/bateria.mjs                      → staging, app local (npm run dev)
//   QA_SITE=https://... node scripts/qa/bateria.mjs  → staging, outra URL (prévia)
//   QA_ALVO=producao node scripts/qa/bateria.mjs     → PRODUÇÃO (só com ok explícito)
//
// Cria contas @qa.harmony.test e dados no bloco Q/R, e apaga tudo ao final.
// Em staging ela reaproveita (e apaga) o Síndico/Subsíndico do seed: rode
// `node scripts/seed-staging.mjs` depois para recriar a base de teste.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const ALVO = process.env.QA_ALVO ?? 'staging';
export const SITE = ALVO === 'producao' ? 'https://harmony-condo-pm-track.vercel.app' : (process.env.QA_SITE ?? 'http://localhost:3000');
export const DOMINIO = 'qa.harmony.test';
export const SENHA = 'Qa-Harmony-2026!';

const env = Object.fromEntries(
  fs.readFileSync(new URL(ALVO === 'producao' ? '../../.env.producao.local' : '../../.env.staging.local', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
export const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REF = ALVO === 'producao' ? 'znajvgkfhucidxtsfdip' : 'yusmuzifhhlowuqtcnid';
if (!URL_SB.includes(REF)) throw new Error(`credenciais não batem com ${ALVO}`);
console.log(`[alvo: ${ALVO} — site ${SITE}]`);

export const admin = createClient(URL_SB, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const anon = () => createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

export async function clientDe(email, senha = SENHA) {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

export async function cookieDe(email, senha = SENHA) {
  const jar = new Map();
  const c = createServerClient(URL_SB, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join('; ');
}

export async function api(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const r = await fetch(SITE + path, {
    method, redirect: 'manual',
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let data; try { data = JSON.parse(txt); } catch { data = txt.slice(0, 120); }
  return { status: r.status, data, location: r.headers.get('location'), headers: r.headers };
}

export async function criarUsuario(email, perfil) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: SENHA, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  if (perfil) {
    const { error: e } = await admin.from('profiles').insert({ id: data.user.id, email, ...perfil });
    if (e) throw new Error(`profile ${email}: ${e.message}`);
  }
  return data.user.id;
}

let falhas = 0;
export const ok = (cond, msg) => { if (!cond) falhas++; console.log(`${cond ? '✓' : '✗ FALHA'} ${msg}`); };
export const resumo = () => console.log(`\n==> ${falhas === 0 ? 'TUDO OK' : falhas + ' FALHA(S)'}`);

export async function limparQA() {
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users.filter((x) => x.email?.endsWith('@' + DOMINIO))) {
    await admin.from('profiles').delete().eq('id', u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
  const { data: us } = await admin.from('units').select('id').in('bloco', ['Q', 'R']);
  const ids = (us ?? []).map((u) => u.id);
  await admin.from('autocadastros').delete().like('email', `%@${DOMINIO}`);
  await admin.from('reservations').delete().in('bloco', ['Q', 'R']);
  await admin.from('fines').delete().in('bloco', ['Q', 'R']);
  await admin.from('vehicles').delete().in('bloco', ['Q', 'R']);
  await admin.from('notifications').delete().like('titulo', 'QA%');
  await admin.from('notices').delete().like('titulo', 'QA%');
  await admin.from('documents').delete().like('titulo', 'QA%');
  await admin.from('spaces').delete().like('nome', 'QA%');
  await admin.from('pending_invites').delete().like('email', `%@${DOMINIO}`);
  await admin.from('audit_logs').delete().or('usuario_nome.like.QA%,acao.like.QA%');
  if (ids.length) await admin.from('units').delete().in('id', ids);
}
