// Mede, em WebKit de verdade (o motor do Safari do iPhone), se algo estoura a largura de 375px.
// Rodar (staging, com `npm run dev` ativo):  npm i --no-save playwright && npx playwright install webkit && node scripts/qa/webkit-mobile.mjs
// Contas do seed (senha 123456). Sai com código 1 se algum elemento passar da viewport ou houver rolagem horizontal.
import { webkit, devices } from 'playwright';

const SITE = process.env.QA_SITE ?? 'http://localhost:3000';
const SENHA = '123456';
const LARGURA = 375;
let problemas = 0;

// Lista elementos visíveis cujo lado direito passa da viewport (ignora o que está dentro de uma faixa que rola de propósito).
const medir = (raiz) => {
  const w = window.innerWidth;
  const rolavel = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true; } return false; };
  const fora = [];
  for (const el of (raiz ? document.querySelector(raiz) : document.body).querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    if ((r.right > w + 0.5 || r.left < -0.5) && r.left > -1000) { // left < -1000 = campo isca fora da tela de propósito
      if (el.closest('[inert]') || rolavel(el)) continue;
      fora.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''} direita=${Math.round(r.right)} esquerda=${Math.round(r.left)}`);
    }
  }
  return { rolagemHorizontal: document.documentElement.scrollWidth > w, scrollWidth: document.documentElement.scrollWidth, fora: fora.slice(0, 8) };
};

const relatar = (nome, m) => {
  const ruim = m.rolagemHorizontal || m.fora.length > 0;
  if (ruim) problemas++;
  console.log(`${ruim ? '✗' : '✓'} ${nome}${ruim ? ` (scrollWidth ${m.scrollWidth})\n    ${m.fora.join('\n    ')}` : ''}`);
};

async function entrar(page, email) {
  await page.goto(`${SITE}/login`);
  await page.waitForTimeout(2000); // hidratação: preencher antes dela apaga os campos
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', SENHA);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 20000 }).catch(async (e) => {
    console.log('login falhou:', (await page.locator('[role=alert]').allInnerTexts()).join(' | ') || e.message);
    throw e;
  });
}

const browser = await webkit.launch();
const novo = async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: LARGURA, height: 812 } });
  // O WebKit do Playwright no Mac desenha a barra de rolagem de 6px do globals.css e rouba 6px da viewport (o iPhone usa
  // barra sobreposta, que não ocupa espaço). Esconde a barra para medir como no aparelho.
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = '::-webkit-scrollbar{display:none!important}'; document.head.appendChild(st);
  }));
  return ctx.newPage();
};

// Telas públicas
{
  const page = await novo();
  for (const p of ['/login', '/cadastro']) { await page.goto(SITE + p); await page.waitForTimeout(800); relatar(p, await page.evaluate(medir)); }
  await page.context().close();
}

// Modal da reserva: morador toca no dia 20; equipe abre "Registrar reserva"
const modal = async (page, nome) => {
  const dialog = page.locator('#reserva-dialog');
  await dialog.waitFor();
  await page.waitForTimeout(500);
  const m = await page.evaluate(medir, '#reserva-dialog');
  const ini = await page.evaluate(() => { const a = document.getElementById('reserva-inicio')?.getBoundingClientRect(), b = document.getElementById('reserva-fim')?.getBoundingClientRect(), d = document.getElementById('reserva-data')?.getBoundingClientRect(), j = document.getElementById('reserva-dialog').getBoundingClientRect(); return { ini: a && [a.left, a.right], fim: b && [b.left, b.right], data: d && [d.left, d.right], modal: [j.left, j.right] }; });
  const sobrepoe = ini.ini && ini.fim && ini.ini[1] > ini.fim[0] + 0.5;
  const fimFora = ini.fim && ini.fim[1] > ini.modal[1] + 0.5;
  console.log(`  medidas ${nome}: ${JSON.stringify(ini)}`);
  if (sobrepoe || fimFora) { problemas++; console.log(`✗ ${nome}: Início/Término ${sobrepoe ? 'se sobrepõem' : ''} ${fimFora ? 'passam da borda do modal' : ''}`); }
  relatar(`${nome} (modal)`, m);
};
{
  const page = await novo();
  await entrar(page, 'morador@staging.test');
  await page.goto(SITE + '/reservas');
  await page.waitForSelector('[data-dia]');
  await page.getByRole('radio', { name: /Salão/ }).click();
  await page.waitForTimeout(1000);
  await page.locator('[data-dia]').filter({ hasText: /^20/ }).first().click();
  await modal(page, 'morador, dia 20');
  await page.context().close();
}
{
  const page = await novo();
  await entrar(page, 'sindico@staging.test');
  await page.goto(SITE + '/reservas');
  await page.getByRole('button', { name: 'Registrar reserva' }).first().click();
  await modal(page, 'equipe, Registrar reserva');
  await page.context().close();
}

// Modal de multa (síndico): tem campos de data e de data/hora
{
  const page = await novo();
  await entrar(page, 'sindico@staging.test');
  await page.goto(SITE + '/multas');
  await page.getByRole('button', { name: /Emitir Notificação/ }).first().click();
  await page.waitForSelector('#multa-modal-title');
  await page.waitForTimeout(500);
  const m = await page.evaluate(medir, '[aria-labelledby=multa-modal-title]');
  const j = await page.evaluate(() => { const d = document.querySelector('[aria-labelledby=multa-modal-title]').getBoundingClientRect(); return [d.left, d.right]; });
  console.log(`  medidas modal de multa: ${JSON.stringify(j)}`);
  relatar('síndico, modal de multa', m);
  await page.context().close();
}

// Telas principais (morador e síndico), 375px
const telas = [['morador@staging.test', ['/', '/veiculos', '/moradores', '/multas', '/mural', '/links', '/reservas']],
               ['sindico@staging.test', ['/', '/veiculos', '/moradores', '/multas', '/mural', '/links', '/relatorios', '/usuarios', '/autocadastro', '/reservas']]];
for (const [email, rotas] of telas) {
  const page = await novo();
  await entrar(page, email);
  for (const r of rotas) { await page.goto(SITE + r); await page.waitForTimeout(1500); relatar(`${email.split('@')[0]} ${r}`, await page.evaluate(medir)); }
  await page.context().close();
}
await browser.close();
console.log(problemas ? `\n==> ${problemas} PROBLEMA(S)` : '\n==> TUDO OK');
process.exit(problemas ? 1 : 0);
