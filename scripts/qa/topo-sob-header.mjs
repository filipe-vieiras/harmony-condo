// Mede se o topo do conteúdo fica escondido atrás do header fixo (sticky) ao rolar até o fim e ao voltar ao topo.
// Rodar (staging, `npm run dev` ativo; só leitura, não grava nada):
//   npm i --no-save playwright && QA_SITE=http://localhost:3001 node scripts/qa/topo-sob-header.mjs
// Sai com código 1 se, na rolagem 0, o conteúdo começar acima da base do header, ou se o header sair do topo.
import { webkit, chromium, devices } from 'playwright';

const SITE = process.env.QA_SITE ?? 'http://localhost:3000';
const SENHA = '123456';
const TELAS = ['/', '/reservas', '/veiculos', '/usuarios', '/moradores', '/mural'];
let problemas = 0;

async function entrar(page, email) {
  await page.goto(`${SITE}/login`);
  await page.waitForTimeout(2000); // hidratação: preencher antes dela apaga os campos
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', SENHA);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 30000 });
}

const medir = () => {
  const h = document.querySelector('header').getBoundingClientRect();
  const main = document.querySelector('main');
  const filho = main.firstElementChild;
  const f = filho ? filho.getBoundingClientRect() : { top: 0 };
  return {
    scrollY: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, inner: innerHeight,
    headerTop: Math.round(h.top), headerBottom: Math.round(h.bottom), conteudoTop: Math.round(f.top),
    // 'doc' = posição do conteúdo no documento (independe da rolagem): tem de ser >= base do header
    conteudoNoDoc: Math.round(f.top + scrollY), headerH: Math.round(h.height),
  };
};

async function rodar(nome, tipo, ctxOpts, tela) {
  const browser = await tipo.launch();
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = '::-webkit-scrollbar{display:none!important}'; document.head.appendChild(st);
  }));
  const page = await ctx.newPage();
  await entrar(page, 'adm@staging.test');
  for (const rota of TELAS) {
    await page.goto(SITE + rota);
    await page.waitForSelector("header", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    if (!(await page.$("header"))) { console.log("? " + nome + " " + rota + " sem header (url " + new URL(page.url()).pathname + ")"); continue; }
    const topo = await page.evaluate(medir);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const fim = await page.evaluate(medir);
    // Simula a barra de endereço do Safari recolhendo (viewport mais alta) com a página no fim
    const vp = page.viewportSize();
    await page.setViewportSize({ width: vp.width, height: vp.height + 90 });
    await page.waitForTimeout(300);
    const fimAlta = await page.evaluate(medir);
    await page.setViewportSize(vp);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const volta = await page.evaluate(medir);
    // Conteúdo no documento acima da base do header = escondido de partida; header fora do topo = sticky quebrado
    const ruim = topo.conteudoNoDoc < topo.headerBottom - 0.5 || fim.headerTop !== 0 || fimAlta.headerTop !== 0 || volta.conteudoTop < volta.headerBottom - 0.5;
    if (ruim) problemas++;
    console.log(`${ruim ? '✗' : '✓'} ${nome} ${rota}  topo: conteudo=${topo.conteudoTop} header=${topo.headerBottom} | fim: scrollY=${fim.scrollY}/${fim.max} headerTop=${fim.headerTop} | fim(+90px): headerTop=${fimAlta.headerTop} | volta: conteudo=${volta.conteudoTop} header=${volta.headerBottom}`);
  }
  await browser.close();
}

await rodar('webkit-iPhone13-667', webkit, { ...devices['iPhone 13'], viewport: { width: 375, height: 667 } });
await rodar('webkit-iPhone13-812', webkit, { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } });
for (const w of [375, 640, 768, 1024, 1280]) await rodar(`chromium-${w}`, chromium, { viewport: { width: w, height: 800 } });
console.log(problemas ? `\n${problemas} tela(s) com problema` : '\nTudo certo');
process.exit(problemas ? 1 : 0);
