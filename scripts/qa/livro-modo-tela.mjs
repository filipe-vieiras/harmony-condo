// Telas do Livro por modo (staging, `npm run dev` ativo; rode o seed antes e depois): DESLIGADO mostra página neutra a quem não
// administra o interruptor, "Livro desligado" no registro para Síndico e ADM, e o aviso do editor muda em EQUIPE.
import { chromium } from 'playwright';
import { admin, ok, resumo, SITE } from './lib.mjs';

const b = await chromium.launch();
const ver = async (conta, rota) => {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  await p.goto(`${SITE}/login`);
  const i = p.locator('input'); await i.nth(0).fill(conta); await i.nth(1).fill('123456');
  await p.getByRole('button', { name: /Entrar/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  await p.goto(SITE + rota); await p.waitForTimeout(3000);
  const txt = await p.evaluate(() => document.querySelector('main')?.innerText ?? '');
  await ctx.close();
  return txt;
};
await admin.from('livro_config').update({ modo: 'DESLIGADO' }).eq('id', 1);
for (const [conta, rot] of [['morador@staging.test', 'Morador'], ['zelador@staging.test', 'Zelador'], ['conselho@staging.test', 'Conselho'], ['subsindico@staging.test', 'Subsíndico'], ['provisorio@staging.test', 'Provisório']]) {
  for (const rota of ['/livro', '/livro/remocoes']) {
    const t = await ver(conta, rota);
    ok(/Página não encontrada/.test(t) && !/Livro de reclamações|Os moradores e a gestão|Registro de remoções|Sem acesso/.test(t), `[modo DESLIGADO] ${rot} em ${rota}: página neutra, sem título nem frase do livro`);
  }
}
for (const [conta, rot] of [['sindico@staging.test', 'Síndico'], ['adm@staging.test', 'ADM']]) {
  const t1 = await ver(conta, '/livro');
  ok(/Livro de reclamações/.test(t1) && /Quem pode usar o Livro/.test(t1), `[modo DESLIGADO] ${rot}: /livro mostra a tela com o painel do interruptor`);
  const t2 = await ver(conta, '/livro/remocoes');
  ok(/Livro desligado/.test(t2) && !/Sem acesso/.test(t2), `[modo DESLIGADO] ${rot}: /livro/remocoes mostra "Livro desligado"`);
}
await admin.from('livro_config').update({ modo: 'EQUIPE' }).eq('id', 1);
const eq = await ver('conselho@staging.test', '/livro');
ok(/Modo de teste da equipe/.test(eq) || /Li as regras/.test(eq), '[modo EQUIPE] Conselho vê o livro (aviso de modo de teste no editor após a ciência)');
await admin.from('livro_ciencia').insert({ usuario_id: (await admin.from('profiles').select('id').eq('email', 'conselho@staging.test').single()).data.id, versao: 1 });
const eq2 = await ver('conselho@staging.test', '/livro');
ok(/Modo de teste da equipe: só a gestão e o Conselho veem este livro/.test(eq2) && !/Todos os moradores veem/.test(eq2), '[modo EQUIPE] o aviso do editor diz que é modo de teste da equipe');
await admin.from('livro_config').update({ modo: 'ABERTO' }).eq('id', 1);
const ab = await ver('conselho@staging.test', '/livro');
ok(/Todos os moradores veem o que você escreve/.test(ab), '[modo ABERTO] o aviso do editor volta ao texto de livro aberto');
await admin.from('livro_config').update({ modo: 'DESLIGADO' }).eq('id', 1);
await admin.from('livro_ciencia').delete().not('usuario_id', 'is', null);
await b.close();
resumo();
