// QA adversarial do Livro de reclamações (migração 0043), com as contas do SEED de staging (*@staging.test, senha 123456).
// Complementa livro.mjs (que usa contas @qa.harmony.test): aqui o foco é a matriz perfil x modo do interruptor, REST/RPC
// forjados, texto hostil, concorrência e mudança de perfil depois de postar ou ser citado.
//   node scripts/qa/livro-extra.mjs        (staging; deixa o Livro DESLIGADO e apaga as mensagens que criou)
import { admin, anon, clientDe, ok, resumo, URL_SB, ANON } from './lib.mjs';

const SENHA_SEED = '123456';
const T = '[livro-extra]';
const em = (n) => `${n}@staging.test`;
const modo = async (m) => { await admin.from('livro_config').update({ modo: m }).eq('id', 1); };
const reset = async () => {
  await admin.from('livro_mensagens').delete().not('id', 'is', null);
  await admin.from('notifications').delete().eq('titulo', 'Livro de reclamações');
};
const nomes = ['sindico', 'subsindico', 'adm', 'conselho', 'conselho2', 'morador', 'inquilino', 'zelador', 'portaria', 'provisorio', 'candidato1'];
const cl = {};
for (const n of nomes) cl[n] = await clientDe(em(n), SENHA_SEED);
const vis = anon();
const { data: perfis } = await admin.from('profiles').select('id,email,role');
const idDe = (n) => perfis.find((p) => p.email === em(n))?.id;
const rpc = (c, fn, a) => c.rpc(fn, a);
const msg = (r) => r.error?.message ?? '';
const nega = (r) => !!r.error && (r.error.code === '42501' || /permission|sem_permissao|JWT|not allowed/i.test(r.error.message ?? ''));
const pub = (c, pai, texto, citados = []) => rpc(c, 'livro_publicar', { p_pai: pai, p_texto: texto, p_citados: citados });
const avisos = async (id) => (await admin.from('notifications').select('id,mensagem,link_destino,created_at').eq('usuario_id_alvo', id).eq('titulo', 'Livro de reclamações').order('created_at')).data ?? [];

await admin.from('profiles').update({ role: 'CONSELHO', desativado_em: null }).eq('id', idDe('conselho2'));
await admin.from('profiles').update({ role: 'SUBSINDICO', desativado_em: null }).eq('id', idDe('subsindico'));
await modo('DESLIGADO'); await reset();

// ── 1. Matriz perfil x modo, na prática (RPC) ──
const perfilDe = { conselho2: 'CONSELHO', candidato1: 'MORADOR', sindico: 'SINDICO', subsindico: 'SUBSINDICO', adm: 'ADM', conselho: 'CONSELHO', morador: 'MORADOR', inquilino: 'MORADOR', zelador: 'ZELADOR', portaria: 'PORTARIA', provisorio: 'MORADOR(prov)' };
const lerEsperado = { DESLIGADO: [], EQUIPE: ['sindico', 'subsindico', 'adm', 'conselho', 'conselho2'], ABERTO: ['sindico', 'subsindico', 'adm', 'conselho', 'conselho2', 'morador', 'inquilino', 'zelador', 'portaria', 'candidato1'] };
const escreveEsperado = ['sindico', 'subsindico', 'conselho', 'conselho2', 'morador', 'inquilino', 'candidato1'];
// A abertura a moradores exige a liberação (só migração/service role): o teste a concede e a retira ao fim.
await admin.from('livro_config').update({ liberado_para_abrir: true }).eq('id', 1);
await modo('ABERTO');
for (const n of ['sindico', 'subsindico', 'conselho', 'conselho2', 'morador', 'inquilino', 'candidato1']) await rpc(cl[n], 'livro_dar_ciencia');
const semente = await pub(cl.sindico, null, 'QA extra topico semente do sindico para a matriz');
ok(!semente.error, `${T} semente publicada ${msg(semente)}`);
const idSemente = semente.data?.id;
for (const m of ['DESLIGADO', 'EQUIPE', 'ABERTO']) {
  await modo(m);
  for (const n of nomes) {
    const deveLer = lerEsperado[m].includes(n);
    const a = (await rpc(cl[n], 'livro_acesso')).data;
    const lista = (await rpc(cl[n], 'livro_listar_topicos', {})).data ?? [];
    const rest = (await cl[n].from('livro_mensagens').select('id')).data ?? [];
    const cit = (await rpc(cl[n], 'livro_citaveis')).data ?? [];
    const dev = deveLer && escreveEsperado.includes(n);
    ok(a.podeLer === deveLer && (lista.length > 0) === deveLer && (rest.length > 0) === deveLer, `${T} modo ${m}: ${n} (${perfilDe[n]}) ${deveLer ? 'lê' : 'NÃO lê'} (acesso/RPC/REST)`);
    ok(a.podeEscrever === dev && (cit.length > 0) === dev, `${T} modo ${m}: ${n} ${dev ? 'escreve' : 'NÃO escreve'} (acesso/citáveis)`);
    if (m !== 'DESLIGADO') {
      const r = await rpc(cl[n], 'livro_obter_topico', { p_id: idSemente });
      ok((r.data !== null) === deveLer, `${T} modo ${m}: ${n} obter_topico ${deveLer ? 'devolve' : 'devolve nulo'}`);
    }
    if (!dev) {
      const p = await pub(cl[n], null, `QA extra tentativa de ${n} no modo ${m}`);
      ok(nega(p), `${T} modo ${m}: ${n} não publica (${msg(p).slice(0, 40)})`);
    }
  }
  // Escrever de verdade em cada modo permitido (resposta ao tópico semente).
  if (m !== 'DESLIGADO') {
    for (const n of escreveEsperado) {
      const deveEscrever = lerEsperado[m].includes(n);
      const r = await pub(cl[n], idSemente, `QA extra resposta de ${n} no modo ${m}`);
      ok(deveEscrever ? !r.error : nega(r), `${T} modo ${m}: ${n} ${deveEscrever ? 'responde' : 'é barrado ao responder'} ${msg(r).slice(0, 40)}`);
    }
    // Registro de remoções
    for (const n of nomes) {
      const deve = ['sindico', 'subsindico', 'adm', 'conselho', 'conselho2'].includes(n) && lerEsperado[m].includes(n);
      const r = await rpc(cl[n], 'livro_registro_remocoes', {});
      ok(deve ? !r.error : nega(r), `${T} modo ${m}: registro de remoções ${deve ? 'abre' : 'negado'} para ${n}`);
    }
    // Interruptor
    for (const n of nomes) {
      const deve = ['sindico', 'adm'].includes(n);
      const r = await rpc(cl[n], 'livro_definir_modo', { p_modo: m });
      ok(deve ? !r.error : nega(r), `${T} modo ${m}: ${n} ${deve ? 'muda' : 'não muda'} o interruptor`);
    }
  }
}
ok(nega(await rpc(vis, 'livro_definir_modo', { p_modo: 'ABERTO' })) && !!(await rpc(vis, 'livro_listar_topicos', {})).error, `${T} visitante: sem acesso por RPC`);
// Visitante via REST puro (sem Authorization de usuário)
for (const t of ['livro_mensagens', 'livro_citacoes', 'livro_remocoes', 'livro_config', 'livro_segredo', 'livro_ciencia', 'livro_sinalizacoes']) {
  const r = await fetch(`${URL_SB}/rest/v1/${t}?select=*`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const j = await r.json().catch(() => null);
  ok(r.status >= 400 || (Array.isArray(j) && j.length === 0), `${T} visitante REST ${t}: status ${r.status}, ${Array.isArray(j) ? j.length : '-'} linhas`);
}

// ── 2. Funções internas e tabelas por REST/RPC ──
await modo('ABERTO');
for (const f of ['_livro_avisar', '_livro_auditar', 'livro_msg_antes', 'livro_msg_depois', 'livro_msg_avisos', 'livro_cit_avisos', 'livro_rem_avisos', 'livro_sin_avisos', 'livro_remocoes_imutavel', '_livro_limpar_vencidos', '_livro_citaveis_todos', '_livro_msg_json']) {
  const alvo = f === '_livro_avisar' ? { p_usuario: idDe('morador'), p_texto: 'Você foi citado no Livro', p_link: '/livro', p_equiv: null, p_papeis: ['MORADOR'] } : f === '_livro_auditar' ? { p_acao: 'x', p_detalhes: {} } : f === '_livro_citaveis_todos' ? { p_eu: idDe('morador') } : {};
  const r = await rpc(cl.sindico, f, alvo);
  ok(!!r.error && r.error.code !== '', `${T} Síndico não executa a função interna ${f} (${r.error?.code ?? 'SEM ERRO'})`);
}
const rest = (c, t) => c.from(t);
const alvoMor = await rest(cl.morador, 'livro_mensagens').select('id,texto,autor_nome,autor_unidade,autor_papel').limit(3);
ok(!alvoMor.error && alvoMor.data.length > 0, `${T} Morador lê colunas liberadas por REST`);
for (const col of ['autor_id', '*']) {
  const r = await cl.morador.from('livro_mensagens').select(col).limit(1);
  ok(!!r.error, `${T} Morador REST livro_mensagens select=${col} é negado (${r.error?.code})`);
}
const rr = await cl.sindico.from('livro_mensagens').select('id, livro_citacoes(alvo_usuario_id)').limit(1);
ok(!!rr.error, `${T} embed de coluna interna (alvo_usuario_id) via REST negado`);
const rr2 = await cl.conselho.from('livro_remocoes').select('texto_original');
ok(!!rr2.error, `${T} Conselho REST texto_original negado`);
// PATCH/DELETE direto como cada perfil
for (const n of nomes) {
  const a = await cl[n].from('livro_mensagens').update({ texto: 'QA extra alterado direto' }).eq('id', idSemente);
  const b = await cl[n].from('livro_mensagens').delete().eq('id', idSemente);
  const { data: ainda } = await admin.from('livro_mensagens').select('texto').eq('id', idSemente).single();
  ok(ainda?.texto === 'QA extra topico semente do sindico para a matriz', `${T} ${n}: UPDATE/DELETE direto não altera a mensagem (${a.error?.code ?? 'sem erro'}/${b.error?.code ?? 'sem erro'})`);
}
// Notificações forjadas / lidas de outros
const fn = await cl.sindico.from('notifications').insert({ titulo: 'Livro de reclamações', mensagem: 'Você foi citado no Livro', tipo: 'GERAL', usuario_id_alvo: idDe('morador'), link_destino: '/livro' });
ok(!!fn.error, `${T} Síndico não insere notificação com alvo (${fn.error?.code})`);
await pub(cl.morador, idSemente, 'QA extra resposta que gera aviso ao sindico', []);
const meu = (await cl.morador.from('notifications').select('usuario_id_alvo,titulo')).data ?? [];
ok(meu.every((x) => x.usuario_id_alvo === null || x.usuario_id_alvo === idDe('morador')), `${T} Morador só vê avisos dele ou gerais (REST)`);
const zel = (await cl.zelador.from('notifications').select('titulo,mensagem').eq('titulo', 'Livro de reclamações')).data ?? [];
ok(zel.length === 0, `${T} Zelador não vê nenhum aviso do Livro (${zel.length})`);
const cadSemPerfilEspia = (await cl.portaria.from('notifications').select('titulo').eq('titulo', 'Livro de reclamações')).data ?? [];
ok(cadSemPerfilEspia.length === 0, `${T} Portaria não vê aviso do Livro (${cadSemPerfilEspia.length})`);

// ── 3. Texto hostil ──
await reset();
const U = (s) => s;
const casos = [
  ['só U+200B', '​'.repeat(30), 'texto_vazio'],
  ['só U+3164 (Hangul filler)', 'ㅤ'.repeat(30), 'texto_vazio'],
  ['só U+2800 (braille vazio)', '⠀'.repeat(30), 'texto_vazio'],
  ['só U+00A0 NBSP', ' '.repeat(30), 'texto_vazio'],
  ['só U+00AD soft hyphen', '­'.repeat(30), 'texto_vazio'],
  ['só U+2060/FEFF', '⁠﻿'.repeat(20), 'texto_vazio'],
  ['só U+034F CGJ', '͏'.repeat(30), 'texto_vazio'],
  ['só tags U+E0041', '\u{e0041}'.repeat(30), 'texto_vazio'],
  ['só variation selectors', '️'.repeat(30), 'texto_vazio'],
  ['só U+115F/1160', 'ᅟᅠ'.repeat(15), 'texto_vazio'],
  ['só U+2800 e espaço ideográfico', '　⠀'.repeat(15), 'texto_vazio'],
  ['NUL', 'QA extra com nulo\u0000 no meio do texto', null],
  ['CPF formatado', 'QA extra meu cpf 123.456.789-09 aqui', 'dado_pessoal'],
  ['CPF colado em letras', 'QA extra cpf:12345678909.', 'dado_pessoal'],
  ['CNPJ', 'QA extra cnpj 12345678000195 aqui', 'dado_pessoal'],
  ['e-mail', 'QA extra escreva a maria@gmail.com', 'dado_pessoal'],
  ['e-mail ofuscado "arroba"', 'QA extra maria arroba gmail ponto com', null],
  ['e-mail com U+FF20 (@ largo)', 'QA extra maria＠gmail.com aqui', null],
  ['CPF com espaços', 'QA extra cpf 123 456 789 09 aqui', null],
  ['CPF com letra no meio dos dígitos zero-width', 'QA extra cpf 123.456.789​-09 aqui', 'dado_pessoal'],
  ['telefone', 'QA extra ligue (11) 91234-5678 para falar', null],
  ['link', 'QA extra veja http://exemplo.com/golpe agora', null],
  ['HTML/script/img', 'QA extra <img src=x onerror=alert(1)> <a href="javascript:alert(1)">x</a>', null],
  ['RLO no meio', 'QA extra texto ‮txet‬ invertido ok', null],
  ['FSI/PDI isolates', 'QA extra ⁨isolado⁩ aqui', null],
  ['zalgo', 'QA extra z' + '̀́̂̃̄̅'.repeat(20) + 'algo ok', null],
  ['emoji 600 (1000 pontos de código?)', '😀'.repeat(600), null],
  ['5999 chars', 'a'.repeat(5999), 'texto_longo'],
  ['6001 chars', 'a'.repeat(6001), 'texto_longo'],
  ['\\r\\n misto', 'QA extra linha um\r\nlinha dois\r\n\r\n\r\n\r\nlinha tres', null],
];
const usuariosTexto = ['morador', 'inquilino', 'subsindico', 'conselho'];
let k = 0;
for (const [rot, texto, esperado] of casos) {
  const c = cl[usuariosTexto[k++ % usuariosTexto.length]];
  const r = await pub(c, null, texto);
  if (esperado) ok(msg(r).includes(esperado), `${T} texto "${rot}" -> ${esperado} (obtido: ${msg(r) || 'aceito'})`);
  else {
    const salvo = r.data?.id ? (await admin.from('livro_mensagens').select('texto').eq('id', r.data.id).single()).data?.texto : null;
    console.log(`   info "${rot}": ${r.error ? 'recusado ' + msg(r).slice(0, 60) : 'ACEITO, guardado com ' + (salvo?.length ?? 0) + ' chars'}`);
  }
}
// nunca deve guardar caracteres de direção, nem U+0000
const { data: todos } = await admin.from('livro_mensagens').select('texto');
ok(!todos.some((m) => /[‪-‮⁦-⁩​-‏\u0000]/.test(m.texto)), `${T} nenhum texto guardado tem direção, invisível ou nulo`);
await reset();

// ── 4. Concorrência ──
// 4a) 14 envios simultâneos do mesmo morador: no máximo 10 passam.
await modo('ABERTO');
const par = await Promise.all(Array.from({ length: 14 }, (_, i) => pub(cl.morador, null, `QA extra concorrência número ${i + 100} do mesmo morador`)));
const passaram = par.filter((r) => !r.error).length;
const erros = [...new Set(par.filter((r) => r.error).map((r) => msg(r)))];
ok(passaram === 10, `${T} 14 envios simultâneos: passaram ${passaram} (esperado 10) ${erros.join(',')}`);
// 4b) mesmo texto 5x ao mesmo tempo -> só um
await reset();
const rep = await Promise.all(Array.from({ length: 5 }, () => pub(cl.inquilino, null, 'QA extra mesmo texto disparado em paralelo')));
ok(rep.filter((r) => !r.error).length === 1, `${T} mesmo texto 5x em paralelo: passou ${rep.filter((r) => !r.error).length} (esperado 1)`);
// 4c) topico com 199 respostas, 4 pessoas respondem juntas -> 1 passa
await reset();
const top = await pub(cl.conselho, null, 'QA extra topico quase cheio para concorrência');
await admin.from('livro_mensagens').insert(Array.from({ length: 199 }, (_, i) => ({ pai_id: top.data.id, autor_id: idDe('conselho2'), autor_nome: 'x', autor_unidade: 'B-102', autor_papel: 'MORADOR', texto: `QA extra r${i}`, criada_em: new Date(Date.now() - 864e5 * 2).toISOString() })));
const jun = await Promise.all(['morador', 'inquilino', 'subsindico', 'sindico'].map((n, i) => pub(cl[n], top.data.id, `QA extra corrida pela ultima vaga ${i}`)));
const { data: cheio } = await admin.from('livro_mensagens').select('n_respostas').eq('id', top.data.id).single();
ok(jun.filter((r) => !r.error).length === 1 && cheio.n_respostas === 200, `${T} última vaga com 4 concorrentes: passaram ${jun.filter((r) => !r.error).length}, n_respostas=${cheio.n_respostas}`);
// 4d) sinalizar em paralelo por 3 pessoas -> 1 aviso por gestor
await reset();
const alvo = await pub(cl.conselho, null, 'QA extra mensagem para sinalizacao paralela');
await Promise.all(['morador', 'inquilino', 'subsindico'].map((n) => rpc(cl[n], 'livro_sinalizar', { p_mensagem: alvo.data.id })));
const avSin = (await avisos(idDe('sindico'))).filter((a) => a.mensagem === 'Há mensagens sinalizadas à gestão no Livro');
ok(avSin.length === 1, `${T} 3 sinalizações simultâneas: Síndico recebeu ${avSin.length} aviso(s) (esperado 1)`);
// 4e) remover em paralelo por Síndico e ADM -> 1 registro, 1 aviso
const alvo2 = await pub(cl.morador, null, 'QA extra mensagem removida em paralelo pela gestao');
const rms = await Promise.all([rpc(cl.sindico, 'livro_remover', { p_mensagem: alvo2.data.id, p_motivo: 'OFENSA' }), rpc(cl.adm, 'livro_remover', { p_mensagem: alvo2.data.id, p_motivo: 'REPETIDA' }), rpc(cl.sindico, 'livro_remover', { p_mensagem: alvo2.data.id, p_motivo: 'OUTRO' })]);
const { data: regs } = await admin.from('livro_remocoes').select('id').eq('mensagem_id', alvo2.data.id);
const avRem = (await avisos(idDe('morador'))).filter((a) => a.mensagem === 'Sua mensagem foi removida pela gestão');
ok(regs.length === 1 && avRem.length === 1 && rms.every((r) => !r.error), `${T} 3 remoções simultâneas: ${regs.length} registro(s), ${avRem.length} aviso(s), erros=${rms.filter((r) => r.error).map(msg)}`);
// 4f) Citar a mesma pessoa em paralelo no mesmo tópico por 4 autores diferentes -> 1 aviso
await reset();
const t2 = await pub(cl.conselho, null, 'QA extra topico para citacao paralela ao subsindico');
const lista = async (c) => (await rpc(c, 'livro_citaveis')).data;
const refSub = async (c) => (await lista(c)).find((x) => x.rotulo.startsWith('Subsíndico')).ref;
await Promise.all(['morador', 'inquilino', 'sindico', 'conselho2'].filter((n) => cl[n]).map(async (n, i) => pub(cl[n], t2.data.id, `QA extra citacao paralela numero ${i}`, [await refSub(cl[n])])));
const avSub = (await avisos(idDe('subsindico'))).filter((a) => a.link_destino === `/livro/${t2.data.id}` && /citad/.test(a.mensagem));
ok(avSub.length === 1, `${T} 4 citações simultâneas ao mesmo alvo no mesmo tópico: ${avSub.length} aviso(s) (esperado 1: um por pessoa por tópico)`);
// 4g) resumo diário em paralelo
const resumoS = (await avisos(idDe('sindico'))).filter((a) => a.mensagem === 'Há novas mensagens no Livro');
ok(resumoS.length <= 1, `${T} resumo diário ao Síndico com envios paralelos: ${resumoS.length} (esperado 1)`);

// ── 5. Citações forjadas ──
await reset();
const L = await lista(cl.morador);
const rot = (r) => L.find((x) => x.rotulo.startsWith(r))?.ref;
console.log('   citáveis do morador:', L.map((x) => x.rotulo).join(' | '));
ok(!L.some((x) => /Administradora|Zelador|Portaria|Provis|Candidato/.test(x.rotulo)), `${T} citáveis não incluem ADM, Zelador, Portaria, provisório`);
for (const [rotuloTeste, forjado] of [['id da conta ADM', idDe('adm')], ['id da conta Zelador', idDe('zelador')], ['md5 chute', 'b'.repeat(32)], ['null', null], ['vazio', ''], ['SQL', "x' or '1'='1"]]) {
  const r = await pub(cl.morador, null, `QA extra citando ${rotuloTeste} inválido`, [forjado]);
  ok(r.error && /alvo_invalido|22P02|null/.test(msg(r) + r.error.code) || (forjado === null && !r.error), `${T} citar ${rotuloTeste}: ${r.error ? msg(r) : 'ACEITO'}`);
}
const r5 = await pub(cl.morador, null, 'QA extra citando cinco alvos', L.slice(0, 5).map((x) => x.ref));
const r6 = await pub(cl.morador, null, 'QA extra citando seis alvos distintos', L.slice(0, 6).map((x) => x.ref));
ok(!r5.error && msg(r6).includes('muitos_citados'), `${T} 5 passa, 6 recusa (${msg(r6)})`);
const r7 = await pub(cl.morador, null, 'QA extra citando a mesma 7 vezes', Array(7).fill(L[0].ref));
ok(!r7.error, `${T} mesmo citado repetido 7x vale como 1 (${msg(r7)})`);
const rn = await rpc(cl.morador, 'livro_publicar', { p_pai: null, p_texto: 'QA extra citados nulo explícito', p_citados: null });
ok(!rn.error, `${T} p_citados nulo é aceito como vazio (${msg(rn)})`);
const eu = await rpc(cl.morador, 'livro_citaveis');
ok(!eu.data.some((x) => x.rotulo === 'Unidade A-101'), `${T} o morador não vê a própria unidade na lista de citáveis`);
// Vazamento por livro_citacoes via REST (mensagem removida)
const cit = await pub(cl.morador, null, 'QA extra mensagem que cita o sindico e será removida', [rot('Síndico')]);
await rpc(cl.sindico, 'livro_remover', { p_mensagem: cit.data.id, p_motivo: 'OFENSA' });
const vaz = (await cl.inquilino.from('livro_citacoes').select('rotulo,mensagem_id').eq('mensagem_id', cit.data.id)).data ?? [];
ok(vaz.length === 0, `${T} citação de mensagem REMOVIDA não é legível por REST (${vaz.length} linha(s): ${vaz.map((v) => v.rotulo).join(',')})`);
const vazRpc = (await rpc(cl.inquilino, 'livro_obter_topico', { p_id: cit.data.id })).data;
ok(vazRpc.citados.length === 0, `${T} citação de mensagem removida some na RPC`);

// ── 6. Remoção: autorizações e formatos ──
await reset();
const m = await pub(cl.morador, null, 'QA extra mensagem do morador para testes de remocao');
for (const n of ['inquilino', 'subsindico', 'conselho', 'zelador', 'portaria']) ok(nega(await rpc(cl[n], 'livro_remover', { p_mensagem: m.data.id, p_motivo: 'OFENSA' })), `${T} ${n} não remove mensagem de outro`);
ok(msg(await rpc(cl.sindico, 'livro_remover', { p_mensagem: '00000000-0000-0000-0000-000000000000', p_motivo: 'OFENSA' })).includes('mensagem_inexistente'), `${T} remover inexistente -> mensagem_inexistente`);
const rbad = await rpc(cl.sindico, 'livro_remover', { p_mensagem: 'não-é-uuid', p_motivo: 'OFENSA' });
console.log(`   info remover id inválido: ${rbad.error?.code} ${rbad.error?.message}`);
ok(msg(await rpc(cl.adm, 'livro_remover', { p_mensagem: m.data.id, p_motivo: "OFENSA'; drop table x;--" })).includes('motivo_invalido'), `${T} motivo com SQL recusado`);
ok(msg(await rpc(cl.adm, 'livro_remover', { p_mensagem: m.data.id, p_motivo: 'AUTOR' })).includes('motivo_invalido'), `${T} ADM não usa o motivo AUTOR para remover (encobrir como "pelo autor")`);
ok(msg(await rpc(cl.sindico, 'livro_remover', { p_mensagem: m.data.id, p_motivo: 'ofensa' })).includes('motivo_invalido'), `${T} motivo em minúsculas recusado`);
// Resposta: remover tópico mantém respostas; autor da resposta remove; remover resposta mantém n_respostas
const resp = await pub(cl.inquilino, m.data.id, 'QA extra resposta do inquilino');
await rpc(cl.adm, 'livro_remover', { p_mensagem: m.data.id, p_motivo: 'OUTRO' });
const respostas = (await rpc(cl.morador, 'livro_listar_respostas', { p_topico: m.data.id })).data;
ok(respostas.length === 1 && !respostas[0].removida, `${T} remover o tópico não remove as respostas`);
ok((await rpc(cl.inquilino, 'livro_remover', { p_mensagem: resp.data.id })).data?.ok === true, `${T} autor remove a própria resposta`);
const marc = (await admin.from('livro_remocoes').select('tipo,motivo').eq('mensagem_id', resp.data.id).single()).data;
ok(marc.tipo === 'RESPOSTA' && marc.motivo === 'AUTOR', `${T} registro da resposta: tipo RESPOSTA, motivo AUTOR`);
// Sinalização: removida, própria, Zelador
const m2 = await pub(cl.conselho, null, 'QA extra mensagem do conselho para sinalizar');
ok(nega(await rpc(cl.adm, 'livro_sinalizar', { p_mensagem: m2.data.id })), `${T} ADM não sinaliza`);
ok(msg(await rpc(cl.conselho, 'livro_sinalizar', { p_mensagem: m2.data.id })).includes('mensagem_propria'), `${T} própria mensagem não sinaliza`);
const sSind = await rpc(cl.sindico, 'livro_sinalizar', { p_mensagem: m2.data.id });
console.log(`   info Síndico sinalizando: ${sSind.error ? msg(sSind) : 'permitido'} (aviso volta para ele mesmo?) avisos do síndico: ${(await avisos(idDe('sindico'))).filter((a) => /sinalizada/.test(a.mensagem)).length}`);

// ── 7. Perda de perfil depois de postar ou de ser citado ──
await reset();
const lista2 = await lista(cl.morador);
const refCons2 = (await lista(cl.morador)).find((x) => /Conselho/.test(x.rotulo) && x.tipo === 'PESSOA' && x.rotulo.includes('Dois'))?.ref;
const post = await pub(cl.conselho2, null, 'QA extra topico do conselho dois antes de sair do cargo', []);
const cita = await pub(cl.morador, null, 'QA extra cita o conselho dois e a unidade dele', [refCons2, lista2.find((x) => x.rotulo === 'Unidade B-102')?.ref].filter(Boolean));
ok(!cita.error, `${T} cita Conselho Dois (pessoa e unidade) ${msg(cita)}`);
ok((await avisos(idDe('conselho2'))).filter((a) => /citad/.test(a.mensagem) && a.link_destino === `/livro/${cita.data.id}`).length === 1, `${T} Conselho Dois (citado por pessoa e unidade) recebe 1 aviso`);
// Perde o cargo: vira Morador
await admin.from('profiles').update({ role: 'MORADOR' }).eq('id', idDe('conselho2'));
const acc = (await rpc(cl.conselho2, 'livro_acesso')).data;
ok(acc.papel === 'MORADOR' && acc.podeEscrever === true && acc.podeVerRegistro === false, `${T} ex-Conselho virou Morador: perde o registro (JWT antigo, banco relê) ${JSON.stringify([acc.papel, acc.podeVerRegistro])}`);
ok(nega(await rpc(cl.conselho2, 'livro_registro_remocoes', {})), `${T} ex-Conselho não lê mais o registro`);
const rm = await rpc(cl.conselho2, 'livro_remover', { p_mensagem: post.data.id });
ok(!rm.error, `${T} ex-Conselho (agora Morador) ainda apaga a própria mensagem ${msg(rm)}`);
const vis2 = (await rpc(cl.morador, 'livro_listar_topicos', {})).data.find((x) => x.id === cita.data.id);
console.log(`   info chip após perda de cargo: ${vis2.citados.map((c) => c.rotulo).join(' | ')}`);
// Vira Zelador (só lê): consegue apagar a própria?
const post2 = await pub(cl.conselho2, null, 'QA extra segundo topico do conselho dois antes de virar zelador');
await admin.from('profiles').update({ role: 'PORTARIA' }).eq('id', idDe('conselho2'));
const rz = await rpc(cl.conselho2, 'livro_remover', { p_mensagem: post2.data.id });
ok(!rz.error, `${T} ex-autor que virou Portaria consegue apagar a própria mensagem? (${rz.error ? msg(rz) : 'sim'})  [spec: autor apaga a própria]`);
ok(nega(await pub(cl.conselho2, null, 'QA extra portaria tentando escrever depois de mudar')), `${T} ex-Conselho virou Portaria: não escreve`);
// Desativado depois de postar
await admin.from('profiles').update({ role: 'MORADOR', desativado_em: new Date().toISOString() }).eq('id', idDe('conselho2'));
ok(nega(await rpc(cl.conselho2, 'livro_remover', { p_mensagem: post2.data.id })) && (await rpc(cl.conselho2, 'livro_listar_topicos', {})).data.length === 0, `${T} desativado: não lê nem apaga a própria`);
const noSino = (await cl.conselho2.from('notifications').select('id').eq('titulo', 'Livro de reclamações')).data ?? [];
ok(noSino.length === 0, `${T} desativado não lê os avisos do Livro (${noSino.length})`);
const listaDes = await lista(cl.morador);
ok(!listaDes.some((x) => /Conselho Dois|B-102/.test(x.rotulo)), `${T} desativado some da lista de citáveis`);
const citaDes = await pub(cl.morador, null, 'QA extra cita a unidade da conta desativada', [lista2.find((x) => x.rotulo === 'Unidade B-102')?.ref]);
ok(msg(citaDes).includes('alvo_invalido'), `${T} citar ref de quem foi desativado -> alvo_invalido (${msg(citaDes)})`);
// reativa e restaura
await admin.from('profiles').update({ role: 'CONSELHO', desativado_em: null }).eq('id', idDe('conselho2'));
// Subsíndico rebaixado depois de postar
const ps = await pub(cl.subsindico, null, 'QA extra topico do subsindico antes de ser rebaixado');
await admin.from('profiles').update({ role: 'MORADOR' }).eq('id', idDe('subsindico'));
const accS = (await rpc(cl.subsindico, 'livro_acesso')).data;
ok(accS.papel === 'MORADOR' && !accS.podeVerRegistro, `${T} Subsíndico rebaixado: registro fechado de imediato (${accS.papel})`);
const semUn = await pub(cl.subsindico, null, 'QA extra rebaixado sem unidade tenta escrever');
ok(msg(semUn).includes('sem_unidade'), `${T} rebaixado a Morador sem unidade -> sem_unidade (${msg(semUn)})`);
await admin.from('profiles').update({ role: 'SUBSINDICO' }).eq('id', idDe('subsindico'));
void ps;

// ── 8. Sino: um aviso por pessoa por tópico, link, texto fixo ──
await reset();
const tp = await pub(cl.morador, null, 'QA extra topico do morador para o sino');
const L2 = await lista(cl.inquilino);
const refMor = L2.find((x) => x.rotulo === 'Unidade A-101').ref;
await pub(cl.inquilino, tp.data.id, 'QA extra inquilino cita o morador uma vez', [refMor]);
await pub(cl.inquilino, tp.data.id, 'QA extra inquilino cita o morador de novo', [refMor]);
const avM = await avisos(idDe('morador'));
console.log('   avisos do morador:', avM.map((a) => a.mensagem + ' ' + a.link_destino.slice(0, 14)).join(' | '));
ok(avM.filter((a) => /citad/.test(a.mensagem)).length === 1, `${T} 2 citações no mesmo tópico sem ler: 1 aviso de citação`);
ok(avM.every((a) => a.link_destino === `/livro/${tp.data.id}`), `${T} o link do aviso é /livro/{tópico}`);
// Resposta citando aparece com link do tópico (não da resposta)
// Morador lê o aviso pelo sino (notification_reads) e é citado de novo -> novo aviso
const nid = avM[0].id;
const rd = await cl.morador.from('notification_reads').insert({ notification_id: nid });
await pub(cl.inquilino, tp.data.id, 'QA extra terceira citação após leitura', [refMor]);
console.log(`   leitura do aviso: ${rd.error ? rd.error.message : 'ok'}; avisos agora: ${(await avisos(idDe('morador'))).length}`);
// Zelador/Portaria/ADM não recebem avisos de citação (já cobertos); morador sem unidade
// ── 9. Limpeza ──
await reset();
await admin.from('profiles').update({ role: 'CONSELHO', desativado_em: null }).eq('id', idDe('conselho2'));
await admin.from('profiles').update({ role: 'SUBSINDICO' }).eq('id', idDe('subsindico'));
await admin.from('livro_ciencia').delete().not('usuario_id', 'is', null);
await modo('DESLIGADO');
resumo();
await admin.from('livro_config').update({ liberado_para_abrir: false, modo: 'DESLIGADO' }).eq('id', 1);
