// QA de TELA do Livro de reclamações (migração 0043) em navegador de verdade, com as contas do seed de staging (senha 123456).
//   npm i --no-save playwright && npx playwright install webkit chromium
//   node scripts/qa/livro-tela.mjs     (staging, com `npm run dev` ativo; deixa o Livro DESLIGADO e apaga o que criou)
// Mede, por perfil e em dois tamanhos (iPhone 375px em WebKit; desktop 1280x800 em Chromium): menu, rota, o que aparece na
// tela, rolagem horizontal, alvos de toque abaixo de 44px, erros no console e respostas de rede 4xx/5xx inesperadas.
// Depois exercita os fluxos (ciência, editor, contador, Citar, publicar, responder, apagar, remover, interruptor, estados).
import fs from 'node:fs';
import { webkit, chromium, devices } from 'playwright';
import { admin, clientDe, SITE } from './lib.mjs';

const SENHA = '123456';
const SAIDA = process.env.QA_SAIDA ?? '/tmp/livro-tela';
fs.mkdirSync(SAIDA, { recursive: true });
let falhas = 0;
const ok = (c, m) => { if (!c) falhas++; console.log(`${c ? '✓' : '✗ FALHA'} ${m}`); };
const info = (m) => console.log(`   ${m}`);
const em = (n) => `${n}@staging.test`;

// ── dados ──
const { data: perfis } = await admin.from('profiles').select('id,email,role,name');
const idDe = (n) => perfis.find((p) => p.email === em(n)).id;
const modo = (m) => admin.from('livro_config').update({ modo: m }).eq('id', 1);
async function limpar() {
  await admin.from('livro_mensagens').delete().not('id', 'is', null);
  await admin.from('notifications').delete().eq('titulo', 'Livro de reclamações');
  await admin.from('livro_ciencia').delete().not('usuario_id', 'is', null);
}
await limpar();
await modo('ABERTO');
const sind = await clientDe(em('sindico'), SENHA);
const morCl = await clientDe(em('morador'), SENHA);
for (const n of ['sindico', 'subsindico', 'conselho', 'inquilino']) await (await clientDe(em(n), SENHA)).rpc('livro_dar_ciencia');
const aut = [['morador', 'A-101', 'MORADOR'], ['inquilino', 'A-102', 'MORADOR'], ['candidato1', 'B-101', 'MORADOR'], ['conselho2', 'B-102', 'MORADOR']];
const nomeDe = (n) => perfis.find((p) => p.email === em(n)).name;
const agora = Date.now();
const topicos = Array.from({ length: 27 }, (_, i) => {
  const [n, un, papel] = aut[i % aut.length];
  const t = new Date(agora - (i + 1) * 3600e3).toISOString();
  return { autor_id: idDe(n), autor_nome: nomeDe(n), autor_unidade: un, autor_papel: papel, texto: `QA tela tópico número ${i + 1}. O portão da garagem ficou aberto de novo à noite e quase entrou gente que não mora aqui, vale conversar sobre isso.`, criada_em: t, ultima_atividade_em: t };
});
// Texto difícil: palavra gigante sem espaço, várias linhas, emoji, aspas e HTML
topicos.push({ autor_id: idDe('morador'), autor_nome: nomeDe('morador'), autor_unidade: 'A-101', autor_papel: 'MORADOR', texto: 'QA tela longo ' + 'ABCDEFGHIJ'.repeat(30) + '\nlinha 2 <b>html</b> <script>alert(1)</script> 😀 "aspas"\n\nlinha 4', criada_em: new Date(agora - 100).toISOString(), ultima_atividade_em: new Date(agora - 100).toISOString() });
const { data: ins } = await admin.from('livro_mensagens').insert(topicos).select('id,texto');
const topLongo = ins.find((x) => x.texto.startsWith('QA tela longo')).id;
// Tópico com 35 respostas
const topResp = (await sind.rpc('livro_publicar', { p_pai: null, p_texto: 'QA tela tópico com muitas respostas para paginar', p_citados: [] })).data.id;
await admin.from('livro_mensagens').insert(Array.from({ length: 35 }, (_, i) => ({ pai_id: topResp, autor_id: idDe('inquilino'), autor_nome: nomeDe('inquilino'), autor_unidade: 'A-102', autor_papel: 'MORADOR', texto: `QA tela resposta ${i + 1}`, criada_em: new Date(agora - 864e5 + i * 60e3).toISOString() })));
// Um tópico do Síndico citando o morador, e uma mensagem removida pela gestão e outra pelo autor
const Lm = (await sind.rpc('livro_citaveis')).data;
const citMor = (await sind.rpc('livro_publicar', { p_pai: null, p_texto: 'QA tela síndico cita a unidade do morador A-101', p_citados: [Lm.find((x) => x.rotulo === 'Unidade A-101').ref] })).data.id;
const remG = (await morCl.rpc('livro_publicar', { p_pai: null, p_texto: 'QA tela mensagem que a gestão vai remover', p_citados: [] }));
void remG; // morador ainda sem ciência: falha de propósito
await morCl.rpc('livro_dar_ciencia');
const paraRemover = (await morCl.rpc('livro_publicar', { p_pai: null, p_texto: 'QA tela mensagem que a gestão vai remover', p_citados: [] })).data.id;
await sind.rpc('livro_remover', { p_mensagem: paraRemover, p_motivo: 'OFENSA' });
const paraAutor = (await morCl.rpc('livro_publicar', { p_pai: null, p_texto: 'QA tela mensagem que o próprio autor apagou', p_citados: [] })).data.id;
await morCl.rpc('livro_remover', { p_mensagem: paraAutor });
await admin.from('livro_ciencia').delete().eq('usuario_id', idDe('morador')); // o morador vai dar ciência pela tela

// ── navegador ──
const MEDIR = () => {
  const w = window.innerWidth;
  const rolavel = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true; } return false; };
  const fora = [], pequenos = [];
  const main = document.querySelector('main') ?? document.body;
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    if ((r.right > w + 0.5 || r.left < -0.5) && r.left > -1000 && !el.closest('[inert]') && !rolavel(el)) fora.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')} d=${Math.round(r.right)} e=${Math.round(r.left)}`);
  }
  for (const el of main.querySelectorAll('button, a[href], input:not([type=hidden]), textarea, summary, [role=radio], select')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    if (r.height < 43.5 || r.width < 43.5) pequenos.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.innerText || el.id || '').trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return { rolagem: document.documentElement.scrollWidth > w, sw: document.documentElement.scrollWidth, fora: fora.slice(0, 6), pequenos: pequenos.slice(0, 12) };
};

const lancadores = { mobile: webkit, desktop: chromium };
async function novaPagina(browser, tam) {
  const ctx = await browser.newContext(tam === 'mobile' ? { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } } : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '::-webkit-scrollbar{display:none!important} nextjs-portal{display:none!important}'; document.head.appendChild(st); }));
  const page = await ctx.newPage();
  const log = { erros: [], rede: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.erros.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => log.erros.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && /supabase|localhost/.test(r.url())) log.rede.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`); });
  return { ctx, page, log };
}
async function entrar(page, email) {
  await page.goto(`${SITE}/login`);
  await page.waitForTimeout(1800);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', SENHA);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 25000 });
}
const esperaTela = async (page) => { await page.waitForTimeout(2500); };

const contas = [
  ['sindico', 'Síndico'], ['subsindico', 'Subsíndico'], ['adm', 'ADM'], ['conselho', 'Conselho'], ['morador', 'Morador proprietário'],
  ['inquilino', 'Morador inquilino'], ['zelador', 'Zelador'], ['portaria', 'Portaria'], ['provisorio', 'Provisório'],
];
const resultados = {};
for (const tam of ['mobile', 'desktop']) {
  const browser = await lancadores[tam].launch();
  for (const [conta, rotulo] of contas) {
    const { ctx, page, log } = await novaPagina(browser, tam);
    await entrar(page, em(conta));
    await page.goto(`${SITE}/livro`);
    await esperaTela(page);
    const url = new URL(page.url()).pathname;
    const estado = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.innerText ?? null,
      editor: !!document.getElementById('livro-topico'),
      ciencia: !!document.getElementById('regras-titulo'),
      cartoes: document.querySelectorAll('article').length,
      avisar: [...document.querySelectorAll('button')].filter((b) => /Avisar a gestão/.test(b.innerText)).length,
      apagar: [...document.querySelectorAll('button')].filter((b) => /^\s*Apagar\s*$/.test(b.innerText)).length,
      remover: [...document.querySelectorAll('button')].filter((b) => /^\s*Remover\s*$/.test(b.innerText)).length,
      registro: [...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/livro/remocoes'),
      modo: !!document.getElementById('modo-titulo'),
      indisponivel: /não está disponível/.test(document.body.innerText),
      vermais: [...document.querySelectorAll('button')].some((b) => /Ver mais tópicos/.test(b.innerText)),
    }));
    const menu = await page.evaluate(() => [...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/livro' && !a.closest('main')));
    const m = await page.evaluate(MEDIR);
    await page.screenshot({ path: `${SAIDA}/${tam}-${conta}-livro.png`, fullPage: false });
    resultados[`${tam}/${conta}`] = { url, ...estado, menu, m };
    const lerEsperado = !['provisorio'].includes(conta);
    ok(url === '/livro' || !lerEsperado, `[${tam}] ${rotulo}: /livro abre (${url})`);
    if (lerEsperado) {
      ok(estado.cartoes > 0 && !estado.indisponivel, `[${tam}] ${rotulo}: vê a lista (${estado.cartoes} cartões na 1ª página)`);
      ok(estado.vermais, `[${tam}] ${rotulo}: "Ver mais tópicos" aparece (20 por página)`);
      const escreve = ['sindico', 'subsindico', 'conselho', 'morador', 'inquilino'].includes(conta);
      ok(escreve ? (estado.editor || estado.ciencia) : (!estado.editor && !estado.ciencia), `[${tam}] ${rotulo}: editor ${estado.editor ? 'visível' : 'oculto'}, ciência ${estado.ciencia ? 'pedida' : 'não'}`);
      ok(estado.avisar === 0 ? !['sindico', 'subsindico', 'conselho', 'morador', 'inquilino'].includes(conta) : ['sindico', 'subsindico', 'conselho', 'morador', 'inquilino'].includes(conta), `[${tam}] ${rotulo}: "Avisar a gestão" ${estado.avisar ? 'aparece' : 'não aparece'}`);
      ok(estado.registro === ['sindico', 'subsindico', 'adm', 'conselho'].includes(conta), `[${tam}] ${rotulo}: link do registro ${estado.registro ? 'visível' : 'oculto'}`);
      ok(estado.modo === ['sindico', 'adm'].includes(conta), `[${tam}] ${rotulo}: painel do interruptor ${estado.modo ? 'visível' : 'oculto'}`);
      ok(estado.remover > 0 === ['sindico', 'adm'].includes(conta), `[${tam}] ${rotulo}: botão "Remover" (de outros) ${estado.remover ? 'visível' : 'oculto'}`);
    } else {
      info(`${rotulo}: url=${url} h1=${estado.h1} indisponivel=${estado.indisponivel} cartoes=${estado.cartoes} menu=${menu}`);
      ok(estado.cartoes === 0, `[${tam}] ${rotulo}: não vê mensagens`);
    }
    ok(!m.rolagem && m.fora.length === 0, `[${tam}] ${rotulo}: sem rolagem horizontal ${m.rolagem ? `(scrollWidth ${m.sw}) ${m.fora.join('; ')}` : ''}`);
    if (m.pequenos.length) info(`[${tam}] ${rotulo}: alvos < 44px: ${m.pequenos.join(' | ')}`);
    ok(m.pequenos.length === 0, `[${tam}] ${rotulo}: alvos de toque >= 44px`);
    ok(log.erros.length === 0, `[${tam}] ${rotulo}: console sem erros ${log.erros.slice(0, 3).join(' | ')}`);
    ok(log.rede.length === 0, `[${tam}] ${rotulo}: rede sem 4xx/5xx ${log.rede.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
}
fs.writeFileSync(`${SAIDA}/matriz.json`, JSON.stringify(resultados, null, 1));

// ── Rotas diretas sem permissão ──
{
  const browser = await webkit.launch();
  for (const [conta, rotulo, rota, devePoder] of [
    ['morador', 'Morador', '/livro/remocoes', false], ['inquilino', 'Inquilino', '/livro/remocoes', false], ['zelador', 'Zelador', '/livro/remocoes', false],
    ['portaria', 'Portaria', '/livro/remocoes', false], ['conselho', 'Conselho', '/livro/remocoes', true], ['subsindico', 'Subsíndico', '/livro/remocoes', true],
    ['adm', 'ADM', '/livro/remocoes', true], ['provisorio', 'Provisório', '/livro/remocoes', false], ['provisorio', 'Provisório', `/livro/${topResp}`, false],
    ['zelador', 'Zelador', `/livro/${topResp}`, true], ['portaria', 'Portaria', `/livro/${topResp}`, true],
  ]) {
    const { ctx, page, log } = await novaPagina(browser, 'mobile');
    await entrar(page, em(conta));
    await page.goto(SITE + rota);
    await esperaTela(page);
    const url = new URL(page.url()).pathname;
    const txt = await page.evaluate(() => document.body.innerText);
    const abre = rota.endsWith('remocoes') ? /Registro de remoções/.test(txt) && !/Sem acesso/.test(txt) : /respostas|Nenhuma resposta/.test(txt);
    ok(abre === devePoder, `[rota direta] ${rotulo} em ${rota.replace(topResp, '{id}')}: ${abre ? 'abre' : 'não abre'} (url ${url.replace(topResp, '{id}')}) ${abre ? '' : '→ ' + txt.replace(/\s+/g, ' ').slice(0, 90)}`);
    await ctx.close();
  }
  // Visitante sem login
  const { ctx, page } = await novaPagina(browser, 'mobile');
  for (const rota of ['/livro', `/livro/${topResp}`, '/livro/remocoes']) {
    await page.goto(SITE + rota); await page.waitForTimeout(2000);
    ok(new URL(page.url()).pathname.startsWith('/login') && !/QA tela/.test(await page.evaluate(() => document.body.innerText)), `[visitante] ${rota.replace(topResp, '{id}')} → ${new URL(page.url()).pathname}`);
  }
  await ctx.close();
  await browser.close();
}

// ── Fluxos de tela: Morador no iPhone (375) ──
{
  const browser = await webkit.launch();
  const { ctx, page, log } = await novaPagina(browser, 'mobile');
  await entrar(page, em('morador'));
  await page.goto(`${SITE}/livro`);
  await esperaTela(page);
  // ciência das regras
  ok(await page.locator('#regras-titulo').isVisible(), '[fluxo morador] sem ciência: a tela pede "Li as regras" e esconde o editor');
  ok(await page.locator('#livro-topico').count() === 0, '[fluxo morador] sem ciência não há campo de texto');
  await page.screenshot({ path: `${SAIDA}/mobile-morador-ciencia.png` });
  await page.getByRole('button', { name: 'Li as regras' }).click();
  await page.waitForSelector('#livro-topico');
  ok(true, '[fluxo morador] depois de "Li as regras" o editor aparece');
  const botao = page.getByRole('button', { name: 'Publicar' });
  ok(await botao.isDisabled(), '[fluxo morador] Publicar desativado com o campo vazio');
  await page.fill('#livro-topico', 'curto');
  ok(await botao.isDisabled(), '[fluxo morador] Publicar desativado com menos de 10 caracteres');
  ok(/Escreva pelo menos 10/.test(await page.locator('#livro-topico-ajuda').innerText()), '[fluxo morador] dica "pelo menos 10 caracteres"');
  await page.fill('#livro-topico', ' '.repeat(40));
  ok(await botao.isDisabled(), '[fluxo morador] só espaços: desativado');
  await page.fill('#livro-topico', '​‮'.repeat(20));
  ok(await botao.isDisabled(), '[fluxo morador] só invisíveis/direção: desativado');
  await page.fill('#livro-topico', 'x'.repeat(1001));
  ok(await botao.isDisabled() && /1001\/1000/.test(await page.locator('#livro-topico-ajuda').innerText()), '[fluxo morador] 1001 caracteres: desativado e contador 1001/1000');
  ok(await page.locator('#livro-topico-ajuda [aria-live=polite]').count() === 1, '[fluxo morador] contador em aria-live polite');
  await page.fill('#livro-topico', '😀'.repeat(600));
  const cont600 = await page.locator('#livro-topico-ajuda [aria-live=polite]').innerText();
  info(`600 emojis (600 caracteres reais): contador mostra ${cont600}; Publicar ${await botao.isDisabled() ? 'DESATIVADO' : 'ativo'}`);
  ok(!(await botao.isDisabled()), `[fluxo morador] 600 emojis (600 caracteres) deveriam poder ser enviados (contador ${cont600})`);
  await page.fill('#livro-topico', 'QA tela escrevi meu cpf 123.456.789-09 sem querer');
  // A tela avisa antes de enviar (o banco recusa de novo, conferido em livro.mjs): botão desativado e dica; o texto fica.
  await page.waitForTimeout(300);
  ok(await botao.isDisabled() && /Retire dados pessoais/.test(await page.locator('#livro-topico-ajuda').innerText()), '[fluxo morador] CPF no texto: Publicar desativa e a tela pede para retirar dados pessoais');
  ok((await page.inputValue('#livro-topico')).includes('123.456.789-09'), '[fluxo morador] o texto digitado não se perde');
  // Citar
  // Também ao fechar por "Concluir" (WebKit no mobile: o toque não foca o botão, o foco volta pela referência guardada).
  await page.getByRole('button', { name: /^Citar/ }).click();
  await page.waitForSelector('#folha-citar-titulo');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForTimeout(400);
  ok(/Citar/.test(await page.evaluate(() => document.activeElement?.innerText?.trim().slice(0, 20) ?? '')), '[fluxo morador] foco volta ao botão "Citar" ao fechar por Concluir');
  await page.getByRole('button', { name: /^Citar/ }).click();
  await page.waitForSelector('#folha-citar-titulo');
  const folha = await page.evaluate(() => { const d = document.querySelector('[aria-labelledby=folha-citar-titulo]'); const r = d.getBoundingClientRect(); return { w: r.width, h: r.height, vh: innerHeight, foco: document.activeElement?.id || document.activeElement?.tagName }; });
  ok(folha.w >= 374 && folha.h >= folha.vh - 1, `[fluxo morador] folha "Citar" ocupa a tela no celular (${Math.round(folha.w)}x${Math.round(folha.h)} de ${folha.vh})`);
  await page.waitForSelector('[aria-labelledby=folha-citar-titulo] ul button');
  await page.screenshot({ path: `${SAIDA}/mobile-morador-citar.png` });
  const itens = await page.locator('[aria-labelledby=folha-citar-titulo] ul button').allInnerTexts();
  info(`itens da folha: ${itens.join(' | ')}`);
  ok(!itens.some((t) => /A-101/.test(t)), '[fluxo morador] a própria unidade não aparece na folha');
  ok(!itens.some((t) => /Zelador|Portaria|Administradora/i.test(t)), '[fluxo morador] ADM, Zelador e Portaria não aparecem na folha');
  await page.fill('#citar-busca', 'sindico');
  await page.waitForTimeout(300);
  ok((await page.locator('[aria-labelledby=folha-citar-titulo] ul button').allInnerTexts()).every((t) => /ndico/.test(t)) && (await page.locator('[aria-labelledby=folha-citar-titulo] ul button').count()) === 2, '[fluxo morador] busca "sindico" (sem acento) acha Síndico e Subsíndico');
  await page.fill('#citar-busca', 'zzzz');
  ok(/Nenhuma unidade ou cargo/.test(await page.locator('[aria-labelledby=folha-citar-titulo]').innerText()), '[fluxo morador] busca sem resultado mostra mensagem');
  await page.fill('#citar-busca', '');
  const todos = page.locator('[aria-labelledby=folha-citar-titulo] ul button');
  const n = await todos.count();
  for (let i = 0; i < Math.min(n, 5); i++) await todos.nth(i).click();
  if (n > 5) ok(await todos.nth(5).isDisabled(), '[fluxo morador] 6º item fica bloqueado depois de 5 marcados');
  info(`itens citáveis para o morador: ${n}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok(await page.locator('#folha-citar-titulo').count() === 0, '[fluxo morador] Esc fecha a folha');
  const focoVolta = await page.evaluate(() => document.activeElement?.innerText?.trim().slice(0, 20));
  info(`foco após fechar a folha: "${focoVolta}"`);
  ok(/Citar/.test(focoVolta ?? ''), `[fluxo morador] foco volta ao botão "Citar" ao fechar a folha (foco em "${focoVolta}")`);
  await page.getByRole('button', { name: /^Citar/ }).click();
  await page.waitForSelector('#folha-citar-titulo');
  await page.getByRole('button', { name: 'Concluir' }).click();
  const chips = await page.locator('form >> text=Tirar a citação').count();
  info(`chips mantidos ao concluir: ${await page.locator('button[aria-label^="Tirar a citação"]').count()}`);
  // Publicar de verdade, duplo clique
  await page.fill('#livro-topico', 'QA tela meu tópico novo publicado com duplo clique');
  const cits = await page.locator('button[aria-label^="Tirar a citação"]').count();
  const antes = (await admin.from('livro_mensagens').select('id', { count: 'exact', head: true }).like('texto', 'QA tela meu tópico novo%')).count;
  await botao.dblclick();
  await page.waitForTimeout(2500);
  const depois = (await admin.from('livro_mensagens').select('id').like('texto', 'QA tela meu tópico novo%')).data.length;
  ok(depois === antes + 1, `[fluxo morador] duplo clique em Publicar cria 1 tópico (criou ${depois - antes}), citando ${cits}`);
  ok((await page.inputValue('#livro-topico')) === '' && (await page.locator('article').first().innerText()).includes('QA tela meu tópico novo'), '[fluxo morador] tópico novo aparece no topo e o campo limpa');
  const prim = await page.locator('article').first();
  ok(/Você/.test(await prim.innerText()) && /A-101/.test(await prim.innerText()), '[fluxo morador] cartão mostra "Você" e a unidade');
  ok(/Mensagem de Morador Proprietário, unidade A-101/.test((await prim.getAttribute('aria-label')) ?? ''), `[fluxo morador] aria-label do cartão: "${await prim.getAttribute('aria-label')}"`);
  // avisos de quem foi citado
  // Offline
  await ctx.setOffline(true);
  await page.waitForTimeout(500);
  await page.fill('#livro-topico', 'QA tela escrevendo sem conexão de rede nenhuma');
  await page.waitForTimeout(300);
  ok(await page.getByRole('button', { name: 'Publicar' }).isDisabled() && /Sem conexão/.test(await page.locator('form').innerText()), '[fluxo morador] offline: aviso "Sem conexão" e Publicar bloqueado');
  await ctx.setOffline(false);
  await page.waitForTimeout(500);
  ok(!(await page.getByRole('button', { name: 'Publicar' }).isDisabled()), '[fluxo morador] ao voltar a rede, Publicar volta');
  // Falha do servidor no envio: texto não se perde
  await page.route('**/rest/v1/rpc/livro_publicar', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
  await page.getByRole('button', { name: 'Publicar' }).click();
  await page.waitForTimeout(1200);
  ok(/Não foi possível concluir/.test(await page.locator('form [role=alert]').innerText()) && (await page.inputValue('#livro-topico')).includes('sem conexão'), '[fluxo morador] erro 500 no envio: mensagem em português e texto preservado');
  await page.unroute('**/rest/v1/rpc/livro_publicar');
  await page.fill('#livro-topico', '');
  // Paginação de tópicos
  const n1 = await page.locator('article').count();
  await page.getByRole('button', { name: 'Ver mais tópicos' }).click();
  await page.waitForTimeout(1500);
  const n2 = await page.locator('article').count();
  ok(n1 === 20 && n2 > 20 && n2 <= 40, `[fluxo morador] paginação: ${n1} → ${n2} cartões`);
  const ids = await page.evaluate(() => [...document.querySelectorAll('article a[href^="/livro/"]')].map((a) => a.getAttribute('href')));
  ok(new Set(ids).size === ids.length, '[fluxo morador] sem tópicos repetidos depois do "Ver mais"');
  // Mensagens removidas no feed
  const removidas = await page.locator('article [role=note]').allInnerTexts();
  info(`removidas no feed: ${removidas.map((t) => t.replace(/\s+/g, ' ').slice(0, 60)).join(' | ')}`);
  // Tópico longo / HTML como texto
  await page.goto(`${SITE}/livro/${topLongo}`);
  await esperaTela(page);
  const ml = await page.evaluate(MEDIR);
  ok(!ml.rolagem && ml.fora.length === 0, `[fluxo morador] texto com palavra de 300 letras seguidas quebra linha, sem rolagem horizontal ${ml.fora.join(';')}`);
  const corpo = await page.locator('article').first().innerText();
  ok(corpo.includes('<script>alert(1)</script>') && corpo.includes('<b>html</b>') && (await page.locator('article script, article b').count()) === 0, '[fluxo morador] HTML e <script> aparecem como texto puro');
  ok((await page.locator('article a').count()) === 0, '[fluxo morador] sem link clicável dentro do texto');
  await page.screenshot({ path: `${SAIDA}/mobile-morador-topico-longo.png` });
  // Conversa com 35 respostas
  await page.goto(`${SITE}/livro/${topResp}`);
  await esperaTela(page);
  const r1 = (await page.locator('ul > li article').count());
  ok(r1 === 30, `[fluxo morador] conversa: 30 respostas na primeira vez (${r1})`);
  await page.getByRole('button', { name: 'Ver mais respostas' }).click();
  await page.waitForTimeout(1200);
  ok((await page.locator('ul > li article').count()) === 35, `[fluxo morador] "Ver mais respostas" completa as 35 (${await page.locator('ul > li article').count()})`);
  // Responder (campo de resposta) e apagar a própria com o diálogo
  await page.fill('#livro-resposta', 'QA tela minha resposta pela tela');
  await page.getByRole('button', { name: 'Responder' }).click();
  await page.waitForTimeout(2000);
  ok((await page.locator('ul > li article').count()) === 36 && (await page.locator('article').last().innerText()).includes('minha resposta pela tela'), '[fluxo morador] resposta aparece no fim da lista (36)');
  const nTop = await page.evaluate(() => document.querySelector('h2')?.innerText);
  info(`cabeçalho de respostas: ${nTop}`);
  await page.locator('article').last().getByRole('button', { name: 'Apagar' }).click();
  await page.waitForSelector('[role=alertdialog]');
  const dlg = await page.locator('[role=alertdialog]').innerText();
  ok(/Apagar a sua mensagem/.test(dlg), '[fluxo morador] apagar a própria abre o diálogo do app (não window.confirm)');
  await page.screenshot({ path: `${SAIDA}/mobile-morador-apagar.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok((await page.locator('article').last().innerText()).includes('minha resposta pela tela'), '[fluxo morador] Esc no diálogo cancela e não apaga');
  await page.locator('article').last().getByRole('button', { name: 'Apagar' }).click();
  await page.getByRole('button', { name: 'Apagar mensagem' }).click();
  await page.waitForTimeout(2000);
  const nAposApagar = await page.locator('ul > li article').count();
  info(`depois de apagar a resposta 36, a conversa recarrega mostrando ${nAposApagar} respostas (volta à 1ª página)`);
  if (nAposApagar < 36) await page.getByRole('button', { name: 'Ver mais respostas' }).click().then(() => page.waitForTimeout(1200));
  ok(/Você removeu esta mensagem/.test(await page.locator('article', { hasText: 'Você removeu' }).last().innerText()), '[fluxo morador] depois de apagar: "Você removeu esta mensagem"');
  ok(/Ver o texto removido/.test(await page.locator('article', { hasText: 'Você removeu' }).last().innerText()), '[fluxo morador] o autor vê "Ver o texto removido" (90 dias)');
  // Sinalizar
  await page.goto(`${SITE}/livro/${topResp}`);
  await esperaTela(page);
  await page.locator('article').first().getByRole('button', { name: /Avisar a gestão/ }).click();
  await page.waitForTimeout(1200);
  ok(/A gestão foi avisada/.test(await page.locator('article').first().innerText()), '[fluxo morador] "Avisar a gestão" confirma com texto claro');
  // Tópico que não existe
  await page.goto(`${SITE}/livro/00000000-0000-0000-0000-000000000000`);
  await esperaTela(page);
  ok(/não existe mais/.test(await page.evaluate(() => document.body.innerText)), '[fluxo morador] tópico inexistente: "Este tópico não existe mais."');
  await page.goto(`${SITE}/livro/lixo-nao-uuid`);
  await esperaTela(page);
  info(`id inválido na URL: ${(await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(-140)}`);
  // Sino: link do aviso abre o tópico
  await page.goto(`${SITE}/`);
  await esperaTela(page);
  const sino = await page.locator('header button[aria-label*="otifica" i], button[aria-label*="otifica" i]').first();
  info(`botão do sino: ${(await sino.count()) ? await sino.getAttribute('aria-label') : 'não achado'}`);
  if (await sino.count()) {
    await sino.click();
    await page.waitForTimeout(800);
    const linhaCit = page.getByText('Sua unidade foi citada no Livro').first();
    ok(await linhaCit.count() > 0, '[sino] morador vê "Sua unidade foi citada no Livro"');
    await page.screenshot({ path: `${SAIDA}/mobile-morador-sino.png` });
    if (await linhaCit.count()) {
      // O link do aviso é "Ver detalhes →" (clicar no texto só marca como lido).
      await linhaCit.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]').getByRole('link', { name: /Ver detalhes/ }).click();
      await page.waitForTimeout(2500);
      ok(new URL(page.url()).pathname === `/livro/${citMor}`, `[sino] clicar no aviso abre o tópico (${new URL(page.url()).pathname === `/livro/${citMor}` ? 'ok' : new URL(page.url()).pathname})`);
    }
  }
  const errosFiltrados = log.erros.filter((e) => !/500|boom|Failed to load resource|livro_publicar: dado_pessoal|invalid input syntax/.test(e));
  info(`console.error provocados por rejeições esperadas do banco: ${log.erros.length - errosFiltrados.length}`);
  ok(errosFiltrados.length === 0, `[fluxo morador] console sem erros inesperados ${errosFiltrados.slice(0, 3).join(' | ')} (erros totais: ${log.erros.length})`);
  info(`rede 4xx/5xx durante o fluxo: ${[...new Set(log.rede)].join(' | ')}`);
  await ctx.close();
  await browser.close();
}

// ── Fluxos de tela: Síndico (remover, registro, interruptor) em desktop e celular ──
for (const tam of ['desktop', 'mobile']) {
  const browser = await lancadores[tam].launch();
  const { ctx, page, log } = await novaPagina(browser, tam);
  await entrar(page, em('sindico'));
  await page.goto(`${SITE}/livro`);
  await esperaTela(page);
  const alvo = (await morCl.rpc('livro_publicar', { p_pai: null, p_texto: `QA tela mensagem para o síndico remover (${tam})`, p_citados: [] }));
  void alvo;
  await page.reload(); await esperaTela(page);
  const card = page.locator('article', { hasText: `para o síndico remover (${tam})` }).first();
  await card.getByRole('button', { name: 'Remover' }).click();
  await page.waitForSelector('#remover-titulo');
  const radios = await page.locator('input[name=motivo-remocao]').count();
  ok(radios === 5, `[síndico ${tam}] diálogo de remover tem 5 motivos de lista (${radios}) e nenhum campo de texto livre (${await page.locator('#remover-titulo ~ * textarea').count()})`);
  const bc = page.getByRole('button', { name: 'Remover mensagem' });
  ok(await bc.isDisabled(), `[síndico ${tam}] "Remover mensagem" desativado sem motivo`);
  const mm = await page.evaluate(MEDIR);
  ok(!mm.rolagem, `[síndico ${tam}] diálogo sem rolagem horizontal`);
  await page.screenshot({ path: `${SAIDA}/${tam}-sindico-remover.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok(await page.locator('#remover-titulo').count() === 0, `[síndico ${tam}] Esc fecha o diálogo de remoção`);
  ok(/Remover/.test(await page.evaluate(() => document.activeElement?.innerText ?? '')), `[síndico ${tam}] foco volta ao botão "Remover" (foco em "${await page.evaluate(() => (document.activeElement?.innerText ?? document.activeElement?.tagName).slice(0, 20))}")`);
  await card.getByRole('button', { name: 'Remover' }).click();
  await page.locator('label', { hasText: 'Fora do assunto' }).click();
  await bc.dblclick();
  await page.waitForTimeout(2000);
  const regs = (await admin.from('livro_remocoes').select('id,motivo').like('texto_original', `%síndico remover (${tam})%`)).data;
  ok(regs.length === 1 && regs[0].motivo === 'FORA_DO_ASSUNTO', `[síndico ${tam}] remover com duplo clique gera 1 registro (${regs.length}) motivo ${regs[0]?.motivo}`);
  ok(/Mensagem removida pela gestão/.test(await page.locator('article', { hasText: 'Mensagem removida pela gestão' }).first().innerText()), `[síndico ${tam}] aparece "Mensagem removida pela gestão"`);
  // Registro de remoções
  await page.getByRole('link', { name: /Registro de remoções/ }).click();
  await page.waitForSelector('h1');
  await esperaTela(page);
  const reg = await page.evaluate(() => document.body.innerText);
  ok(/Registro de remoções/.test(reg) && /Fora do assunto/.test(reg) && /Ofensa/.test(reg), `[síndico ${tam}] registro lista os motivos`);
  const mr = await page.evaluate(MEDIR);
  ok(!mr.rolagem && mr.fora.length === 0, `[síndico ${tam}] registro sem rolagem horizontal`);
  if (mr.pequenos.length) info(`[síndico ${tam}] registro, alvos < 44px: ${mr.pequenos.join(' | ')}`);
  ok(mr.pequenos.length === 0, `[síndico ${tam}] registro: alvos >= 44px`);
  await page.screenshot({ path: `${SAIDA}/${tam}-sindico-registro.png` });
  // Interruptor
  await page.goto(`${SITE}/livro`);
  await esperaTela(page);
  await page.getByRole('radio', { name: /Só a equipe/ }).click();
  await page.waitForSelector('[role=alertdialog]');
  await page.screenshot({ path: `${SAIDA}/${tam}-sindico-modo.png` });
  const txtDlg = await page.locator('[role=alertdialog]').innerText();
  ok(/Mudar o Livro para/.test(txtDlg), `[síndico ${tam}] mudar o interruptor pede confirmação ("${txtDlg.replace(/\s+/g, ' ').slice(0, 70)}")`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok((await admin.from('livro_config').select('modo').eq('id', 1).single()).data.modo === 'ABERTO', `[síndico ${tam}] cancelar a confirmação não muda o modo`);
  await page.getByRole('radio', { name: /Só a equipe/ }).click();
  await page.getByRole('button', { name: 'Mudar' }).click();
  await page.waitForTimeout(2000);
  ok((await admin.from('livro_config').select('modo').eq('id', 1).single()).data.modo === 'EQUIPE', `[síndico ${tam}] confirmar muda para EQUIPE`);
  ok((await page.getByRole('radio', { name: /Só a equipe/ }).getAttribute('aria-checked')) === 'true', `[síndico ${tam}] o painel marca "Só a equipe" como atual`);
  // Morador (outro contexto) com EQUIPE: a tela diz indisponível e sem menu
  const mctx = await novaPagina(browser, tam);
  await entrar(mctx.page, em('inquilino'));
  await mctx.page.goto(`${SITE}/livro`);
  await esperaTela(mctx.page);
  const t = await mctx.page.evaluate(() => ({ txt: document.body.innerText, menu: [...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/livro') }));
  ok(/não está disponível/.test(t.txt) && !t.menu && !/QA tela/.test(t.txt), `[síndico ${tam}] modo EQUIPE: inquilino vê "não está disponível", sem menu e sem mensagens`);
  await mctx.ctx.close();
  // Desligar e voltar a ABERTO para o próximo ciclo
  // Sem a liberação (feita fora do app) o painel não deixa escolher "Aberto"; com ela, deixa.
  await admin.from('livro_config').update({ liberado_para_abrir: false }).eq('id', 1);
  await page.reload(); await esperaTela(page);
  ok(await page.getByRole('radio', { name: /^Aberto/ }).isDisabled(), `[síndico ${tam}] "Aberto" vem desativado enquanto não for liberado`);
  await admin.from('livro_config').update({ liberado_para_abrir: true }).eq('id', 1);
  await page.reload(); await esperaTela(page);
  await page.getByRole('radio', { name: /Desligado/ }).click();
  await page.getByRole('button', { name: 'Mudar' }).click();
  await page.waitForTimeout(1800);
  ok((await admin.from('livro_config').select('modo').eq('id', 1).single()).data.modo === 'DESLIGADO', `[síndico ${tam}] desligar pelo painel`);
  ok(/Use o quadro acima/.test(await page.evaluate(() => document.body.innerText)), `[síndico ${tam}] desligado: Síndico vê a dica "Use o quadro acima"`);
  await page.getByRole('radio', { name: /^Aberto/ }).click().catch(async () => { await page.locator('[role=radio]', { hasText: 'Aberto' }).last().click(); });
  await page.getByRole('button', { name: 'Mudar' }).click();
  await page.waitForTimeout(1800);
  ok((await admin.from('livro_config').select('modo').eq('id', 1).single()).data.modo === 'ABERTO', `[síndico ${tam}] reabrir pelo painel`);
  const errosS = log.erros.filter((e) => !/Failed to load resource/.test(e));
  ok(errosS.length === 0, `[síndico ${tam}] console sem erros ${errosS.slice(0, 2).join(' | ')}`);
  await ctx.close();
  await browser.close();
}

// ── Estados: carregando, erro e vazio ──
{
  const browser = await webkit.launch();
  const { ctx, page } = await novaPagina(browser, 'mobile');
  await entrar(page, em('inquilino'));
  await page.route('**/rest/v1/rpc/livro_listar_topicos', async (r) => { await new Promise((s) => setTimeout(s, 3500)); try { await r.continue(); } catch {} });
  await page.goto(`${SITE}/livro`);
  await page.waitForTimeout(2500);
  const esq = await page.locator('[role=status][aria-label="Carregando mensagens"] > div').count();
  ok(esq === 3, `[estados] carregando: esqueleto de 3 cartões (${esq})`);
  await page.screenshot({ path: `${SAIDA}/mobile-estado-carregando.png` });
  await page.unroute('**/rest/v1/rpc/livro_listar_topicos');
  await page.route('**/rest/v1/rpc/livro_listar_topicos', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' }));
  await page.goto(`${SITE}/livro`);
  await page.waitForTimeout(3500);
  const erroBox = await page.locator('[role=alert]').first().innerText().catch(() => '');
  ok(/Não foi possível/.test(erroBox) && await page.getByRole('button', { name: 'Tentar de novo' }).count() === 1, `[estados] erro: mensagem em português e "Tentar de novo" ("${erroBox.replace(/\s+/g, ' ').slice(0, 60)}")`);
  await page.screenshot({ path: `${SAIDA}/mobile-estado-erro.png` });
  await page.unroute('**/rest/v1/rpc/livro_listar_topicos');
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await page.waitForTimeout(2500);
  ok((await page.locator('article').count()) > 0, '[estados] "Tentar de novo" recarrega a lista');
  await ctx.close();
  // Vazio: apaga tudo e olha como Morador (que escreve) e como Zelador (que só lê)
  await admin.from('livro_mensagens').delete().not('id', 'is', null);
  for (const [conta, esperaPrimeira] of [['inquilino', true], ['zelador', false]]) {
    const p = await novaPagina(browser, 'mobile');
    await entrar(p.page, em(conta));
    await p.page.goto(`${SITE}/livro`);
    await esperaTela(p.page);
    const txt = await p.page.evaluate(() => document.body.innerText);
    ok(/Ainda não há mensagens\./.test(txt) && /Escreva a primeira/.test(txt) === esperaPrimeira, `[estados] vazio para ${conta}: ${esperaPrimeira ? 'convida a escrever' : 'só "Ainda não há mensagens."'}`);
    await p.page.screenshot({ path: `${SAIDA}/mobile-estado-vazio-${conta}.png` });
    await p.ctx.close();
  }
  await browser.close();
}

await limpar();
await modo('DESLIGADO');
await admin.from('livro_config').update({ liberado_para_abrir: false, modo: 'DESLIGADO' }).eq('id', 1);
console.log(`\n==> ${falhas === 0 ? 'TUDO OK' : falhas + ' FALHA(S)'}  (capturas em ${SAIDA})`);
process.exit(falhas ? 1 : 0);
