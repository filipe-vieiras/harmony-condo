// Mede, em WebKit de verdade (o motor do Safari do iPhone), se algo estoura a largura de 375px.
// Rodar (staging, com `npm run dev` ativo):  npm i --no-save playwright && npx playwright install webkit && node scripts/qa/webkit-mobile.mjs
// Contas do seed (senha 123456). Sai com código 1 se algum elemento passar da viewport ou houver rolagem horizontal.
import { webkit, devices } from 'playwright';

const SITE = process.env.QA_SITE ?? 'http://localhost:3000';
// TRAVA: loga com contas de teste e cria/apaga dados. Nunca contra o site de produção.
if (['harmony-condo-pm-track', 'znajvgkfhucidxtsfdip'].some((p) => SITE.includes(p))) throw new Error(`QA recusado: ${SITE} é produção. Estes scripts só rodam no staging.`);
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

// Veículos (cartões e folha inferior), 375px: Síndico (com ações) e Morador (só os próprios). A folha precisa caber na
// largura, ter alvos de 44px, fechar por Esc e devolver o foco ao cartão.
for (const [conta, comAcoes] of [['sindico@staging.test', true], ['morador@staging.test', true], ['portaria@staging.test', false], ['conselho@staging.test', false], ['zelador@staging.test', false]]) {
  const page = await novo();
  await entrar(page, conta);
  await page.goto(SITE + '/veiculos');
  await page.waitForSelector('button[aria-haspopup=dialog]');
  relatar(`${conta.split('@')[0]} /veiculos cartões`, await page.evaluate(medir));
  const cartao = page.locator('button[aria-haspopup=dialog]').first();
  await cartao.click();
  await page.waitForSelector('[role=dialog][aria-label^="Detalhes do veículo"]');
  await page.waitForTimeout(400);
  relatar(`${conta.split('@')[0]} /veiculos folha`, await page.evaluate(medir, '[role=dialog][aria-label^="Detalhes do veículo"]'));
  const acoes = await page.getByRole('button', { name: /Editar veículo|Remover/ }).count();
  const bloqueado = await page.evaluate(() => document.body.style.overflow === 'hidden');
  const pequenos = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button, [role=dialog] a')].filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent.trim()));
  console.log(`  ${comAcoes === (acoes > 0) ? '✓' : '✗ PROBLEMA'} ações na folha: ${acoes} (esperado ${comAcoes ? 'com' : 'sem'} ações do veículo)`);
  if (comAcoes !== (acoes > 0)) problemas++;
  console.log(`  ${bloqueado && pequenos.length === 0 ? '✓' : '✗ PROBLEMA'} rolagem travada e alvos >= 44px (pequenos: ${pequenos.join('|') || 'nenhum'})`);
  if (!bloqueado || pequenos.length) problemas++;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const fechou = (await page.locator('[role=dialog][aria-label^="Detalhes do veículo"]').count()) === 0;
  const foco = await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup'));
  console.log(`  ${fechou && foco === 'dialog' ? '✓' : '✗ PROBLEMA'} Esc fecha a folha e o foco volta ao cartão (foco: ${foco})`);
  if (!fechou || foco !== 'dialog') problemas++;
  await page.context().close();
}

// Estouro horizontal de /veiculos (e das telas irmãs) em várias larguras, do celular ao desktop. O cabeçalho já cortou o botão
// "Cadastrar Veículo" entre 640px e 1279px.
{
  const LARGURAS = [375, 600, 640, 768, 900, 1000, 1023, 1024, 1100, 1279, 1280];
  const casos = [['sindico@staging.test', ['/veiculos', '/reservas', '/moradores', '/usuarios']], ['portaria@staging.test', ['/veiculos']], ['morador@staging.test', ['/veiculos']], ['zelador@staging.test', ['/veiculos']]];
  for (const [conta, rotas] of casos) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
    const page = await ctx.newPage();
    await entrar(page, conta);
    for (const r of rotas) {
      const ruins = [];
      for (const w of LARGURAS) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.goto(SITE + r);
        await page.waitForTimeout(1200);
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        if (sw > cw) ruins.push(`${w}px: ${sw}`);
      }
      if (ruins.length) problemas++;
      console.log(`${ruins.length ? '✗ PROBLEMA' : '✓'} ${conta.split('@')[0]} ${r}: sem rolagem horizontal em ${LARGURAS.length} larguras${ruins.length ? ' (estouro em ' + ruins.join(', ') + ')' : ''}`);
    }
    await ctx.close();
  }
}

// Telas principais (morador e síndico), 375px
const telas = [['morador@staging.test', ['/', '/veiculos', '/moradores', '/multas', '/mural', '/links', '/reservas', '/livro']],
               ['sindico@staging.test', ['/', '/veiculos', '/moradores', '/multas', '/mural', '/links', '/relatorios', '/usuarios', '/autocadastro', '/reservas', '/livro', '/livro/remocoes']]];
// /livro: com o Livro DESLIGADO (padrão) mede só o estado "indisponível"; as telas cheias (lista, editor, folha Citar, diálogos)
// são medidas em WebKit 375px por scripts/qa/livro-tela.mjs.
for (const [email, rotas] of telas) {
  const page = await novo();
  await entrar(page, email);
  for (const r of rotas) { await page.goto(SITE + r); await page.waitForTimeout(1500); relatar(`${email.split('@')[0]} ${r}`, await page.evaluate(medir)); }
  await page.context().close();
}
await browser.close();
console.log(problemas ? `\n==> ${problemas} PROBLEMA(S)` : '\n==> TUDO OK');
process.exit(problemas ? 1 : 0);
