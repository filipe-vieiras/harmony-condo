// Tentativa de reproduzir a falha intermitente "Subsíndico NÃO cancela transferência -> 401" (transferir-cargo.mjs).
// O login do Auth tem limite de taxa (~30 por 5 min por IP): faz poucos logins e muitas chamadas ao cancelar.
import { api, cookieDe } from './lib.mjs';
const UUID = '00000000-0000-4000-8000-000000000001';
const login = async (e) => { for (let i = 0; i < 20; i++) { try { return await cookieDe(e, '123456'); } catch (x) { if (!/rate limit/i.test(x.message)) throw x; console.log('  (limite de login, espera 20s)'); await new Promise((r) => setTimeout(r, 20000)); } } throw new Error('sem login'); };
const cont = {}; const marca = (k) => { cont[k] = (cont[k] ?? 0) + 1; };
const chama = async (rot, cookie) => { const r = await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie, body: { transferenciaId: UUID } }); marca(`${rot}:${r.status}`); };
const subs = await login('subsindico@staging.test');
const morador = await login('morador@staging.test');
// 1) rajada paralela com sessão recém-criada (primeira chamada compila a rota no dev)
await Promise.all([...Array(30)].map(() => chama('subs rajada', subs)));
// 2) segunda sessão da MESMA conta abre no meio
const subs2 = await login('subsindico@staging.test');
await Promise.all([...Array(30)].map((_, i) => chama(i % 2 ? 'subs sessão 1 após 2º login' : 'subs sessão 2', i % 2 ? subs : subs2)));
// 3) login de outra conta no meio da rajada
const [, adm] = await Promise.all([Promise.all([...Array(20)].map(() => chama('subs durante login alheio', subs))), login('adm@staging.test')]);
void adm; void morador;
// 4) chamada logo após o login, 10 vezes (sem pausa)
for (let i = 0; i < 6; i++) { const c = await login('subsindico@staging.test'); await chama('subs imediatamente após login', c); }
console.log(JSON.stringify(cont, null, 1));
