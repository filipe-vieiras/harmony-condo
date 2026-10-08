// Corridas do Livro: resumo diário à gestão e aviso de citação com várias pessoas publicando ao mesmo tempo.
//   node scripts/qa/livro-corrida.mjs   (staging; deixa o Livro DESLIGADO e apaga o que criou)
import { admin, clientDe, ok, resumo } from './lib.mjs';
const em = (n) => `${n}@staging.test`;
const { data: perfis } = await admin.from('profiles').select('id,email');
const idDe = (n) => perfis.find((p) => p.email === em(n)).id;
const quem = ['morador', 'inquilino', 'candidato1', 'conselho', 'conselho2', 'subsindico'];
const cl = {}; for (const n of [...quem, 'sindico']) cl[n] = await clientDe(em(n), '123456');
await admin.from('livro_config').update({ modo: 'ABERTO' }).eq('id', 1);
for (const n of quem) await cl[n].rpc('livro_dar_ciencia');
const limpar = async () => { await admin.from('livro_mensagens').delete().not('id', 'is', null); await admin.from('notifications').delete().eq('titulo', 'Livro de reclamações'); };
const cont = async (id, txt) => (await admin.from('notifications').select('id').eq('usuario_id_alvo', id).eq('mensagem', txt)).data.length;
let dupResumo = 0, dupCit = 0; const N = 6;
for (let i = 0; i < N; i++) {
  await limpar();
  await Promise.all(quem.map((n, j) => cl[n].rpc('livro_publicar', { p_pai: null, p_texto: `QA corrida resumo rodada ${i} autor ${j} texto`, p_citados: [] })));
  const r = await cont(idDe('sindico'), 'Há novas mensagens no Livro');
  if (r > 1) dupResumo++;
  console.log(`rodada ${i}: resumo ao Síndico = ${r}`);
}
ok(dupResumo === 0, `[corrida] resumo diário ao Síndico: ${dupResumo} de ${N} rodadas com mais de 1 aviso no dia`);
for (let i = 0; i < N; i++) {
  await limpar();
  const t = (await cl.conselho.rpc('livro_publicar', { p_pai: null, p_texto: `QA corrida citacao topico ${i} base`, p_citados: [] })).data.id;
  await Promise.all(['morador', 'inquilino', 'candidato1', 'conselho2'].map(async (n, j) => {
    const L = (await cl[n].rpc('livro_citaveis')).data; const ref = L.find((x) => x.rotulo.startsWith('Subsíndico')).ref;
    return cl[n].rpc('livro_publicar', { p_pai: t, p_texto: `QA corrida citacao ${i} autor ${j} texto`, p_citados: [ref] });
  }));
  const r = (await admin.from('notifications').select('id').eq('usuario_id_alvo', idDe('subsindico')).eq('link_destino', `/livro/${t}`).like('mensagem', '%citad%')).data.length;
  if (r > 1) dupCit++;
  console.log(`rodada ${i}: avisos de citação ao Subsíndico no mesmo tópico = ${r}`);
}
ok(dupCit === 0, `[corrida] citação paralela ao mesmo alvo e tópico: ${dupCit} de ${N} rodadas com aviso duplicado`);
await limpar();
await admin.from('livro_ciencia').delete().not('usuario_id', 'is', null);
await admin.from('livro_config').update({ modo: 'DESLIGADO' }).eq('id', 1);
resumo();
