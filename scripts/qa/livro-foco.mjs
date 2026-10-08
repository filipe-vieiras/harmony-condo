// Foco e teclado do Livro (Síndico, Chromium desktop): folha "Citar" devolve o foco ao botão, Tab fica dentro, Esc fecha.
import { chromium } from 'playwright';
import { SITE } from './lib.mjs';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(`${SITE}/login`); await page.waitForTimeout(1800);
await page.fill('input[type=email]', 'sindico@staging.test'); await page.fill('input[type=password]', '123456'); await page.click('button[type=submit]');
await page.waitForFunction(() => !location.pathname.startsWith('/login')); await page.goto(`${SITE}/livro`); await page.waitForSelector('#livro-topico');
const btn = page.getByRole('button', { name: /^Citar/ });
await btn.focus(); await page.keyboard.press('Enter'); await page.waitForSelector('#folha-citar-titulo');
console.log('foco ao abrir:', await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('aria-label') || '')));
const dentro = [];
for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); dentro.push(await page.evaluate(() => !!document.activeElement.closest('[aria-labelledby=folha-citar-titulo]'))); }
console.log('Tab fica dentro da folha:', dentro.every(Boolean), dentro.join(','));
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
console.log('foco depois do Esc:', await page.evaluate(() => document.activeElement?.innerText?.trim()));
await btn.click(); await page.waitForSelector('#folha-citar-titulo'); await page.click('button[aria-label=Fechar]'); await page.waitForTimeout(300);
console.log('foco depois de Fechar (clique):', await page.evaluate(() => document.activeElement?.innerText?.trim()));
await b.close();
