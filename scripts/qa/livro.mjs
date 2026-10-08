// Bateria do Livro de reclamações (migração 0043, spec docs/specs/2026-10-07-livro-de-reclamacoes-v2.md).
// Chamada por bateria.mjs (depois de rodarHierarquia) ou sozinha: `node scripts/qa/livro.mjs` (staging).
// Todo teste começa com [livro]. Contas próprias (lv*) e as da equipe de QA; blocos de unidade Q e R (limparQA apaga).
// Cobre: interruptor nos três modos (RPC e REST), leitura por perfil, escrita só dos quatro perfis, limites e filtros do
// texto, citação (lista estruturada, 5 no máximo, quem não é citável, um aviso por pessoa), avisos do sino, remoção
// (quem pode, motivo fechado, registro imutável, texto por 90 dias, contrapeso), "Avisar a gestão", DML direto negado.
import fs from 'node:fs';
import { admin, anon, clientDe, criarUsuario, ok, resumo, limparQA, DOMINIO, SENHA } from './lib.mjs';
import { limparTextoLivre } from '../../src/lib/textoLivre.ts';
import { temDadoPessoal } from '../../src/lib/livro.ts';
import { LIMITES, modoAdmiteLeitura, modoAdmiteEscrita, erroDoLivro, erroEsperado, tamanhoDoTexto, ehUuid, MOTIVOS_REMOCAO, PERFIS_QUE_ESCREVEM, PERFIS_QUE_APAGAM } from '../../src/lib/livro.ts';

const email = (n) => `${n}@${DOMINIO}`;
const T = '[livro]';
const FIXOS = new Set([
  'Você foi citado no Livro', 'Sua unidade foi citada no Livro', 'Sua mensagem foi removida pela gestão',
  'Há novas respostas no seu tópico', 'Há novas mensagens no Livro', 'Há mensagens sinalizadas à gestão no Livro',
]);
const dias = (n) => new Date(Date.now() - n * 864e5).toISOString();
const horas = (n) => new Date(Date.now() - n * 36e5).toISOString();

async function equipe() {
  // Singletons (Síndico, Subsíndico, Zelador): quem ocupa o cargo AGORA (as seções de transferência e de hierarquia da bateria
  // mudam quem é quem). Troca só a senha para a de QA; sem titular ativo, cria a conta.
  const titular = async (role, nomeQA, nome) => {
    const { data: ex } = await admin.from('profiles').select('id,email,name').eq('role', role).is('desativado_em', null).maybeSingle();
    if (ex) {
      await admin.auth.admin.updateUserById(ex.id, { password: SENHA, email_confirm: true, ban_duration: 'none' });
      // Seções anteriores da bateria deixam o titular do cargo como "não validado" (rebaixado e promovido de novo).
      await admin.from('profiles').update({ cadastro_validado: true }).eq('id', ex.id);
      return { id: ex.id, email: ex.email, nome: ex.name };
    }
    const id = await criarUsuario(email(nomeQA), { name: nome, role });
    return { id, email: email(nomeQA), nome };
  };
  const sind = await titular('SINDICO', 'lvsind', 'QA lvsind');
  const sub = await titular('SUBSINDICO', 'lvsub', 'QA lvsub');
  const zel = await titular('ZELADOR', 'lvzel', 'QA lvzel');
  // Perfis que admitem vários: contas novas só do livro.
  const adm = await criarUsuario(email('lvadm'), { name: 'QA lvadm', role: 'ADM' });
  const cons = await criarUsuario(email('lvcons'), { name: 'QA lvcons', role: 'CONSELHO' });
  const port = await criarUsuario(email('lvport'), { name: 'QA lvport', role: 'PORTARIA' });
  return { sind: sind.id, sub: sub.id, zel: zel.id, adm, cons, port, emails: { sind: sind.email, sub: sub.email, zel: zel.email } };
}

export async function rodarLivro() {
  console.log('\n## L. Livro de reclamações (migração 0043)');
  const modo = async (m) => { await admin.from('livro_config').update({ modo: m }).eq('id', 1); };
  await modo('DESLIGADO');

  const E = await equipe();
  // Moradores: unidades Q-903.. (bloco Q) e R-981 (sem conta) e R-982 (conta do Síndico).
  const mkUn = async (bloco, numero, usuario) => {
    const { data } = await admin.from('units').insert({ bloco, numero, proprietario_nome: '', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'DESOCUPADO', moradores: [], vagas_garagem: [], animais: '' }).select().single();
    if (usuario) await admin.from('units').update({ usuario_id: usuario, status_convite: 'ATIVO' }).eq('id', data.id);
    return data.id;
  };
  const mor = async (n, unidade) => {
    const id = await criarUsuario(email(n), { name: `QA ${n}`, role: 'MORADOR', bloco: 'Q', unidade });
    await mkUn('Q', unidade, id);
    return id;
  };
  const lv1 = await mor('lv1', '911'), lv2 = await mor('lv2', '912'), lv3 = await mor('lv3', '913');
  const lv4 = await mor('lv4', '914'), lv5 = await mor('lv5', '915'), lv6 = await mor('lv6', '918'), lv7 = await mor('lv7', '919'), lv8 = await mor('lv8', '920'), lv9 = await mor('lv9', '921'), lv10 = await mor('lv10', '922');
  const cons2 = await criarUsuario(email('lvcons2'), { name: 'QA lvcons2', role: 'CONSELHO' });
  const uSemConta = await mkUn('R', '981', null);
  const uSind = await mkUn('R', '982', E.sind);
  const prov = await criarUsuario(email('lvprov'), { name: 'QA lvprov', role: 'MORADOR', cadastro_validado: false });
  const semPerfil = await criarUsuario(email('lvsemperfil'), null);
  const mdes = await mor('lvdes', '916');
  const outroMor = await criarUsuario(email('lvmor6'), { name: 'QA lvmor6', role: 'MORADOR', bloco: 'Q', unidade: '917' });
  void outroMor; void semPerfil; void uSemConta;

  const cl = {};
  for (const [k, n] of Object.entries({ sind: E.emails.sind, sub: E.emails.sub, adm: email('lvadm'), cons: email('lvcons'), port: email('lvport'), zel: E.emails.zel, m1: email('lv1'), m2: email('lv2'), m3: email('lv3'), m4: email('lv4'), m5: email('lv5'), m6: email('lv6'), m7: email('lv7'), m8: email('lv8'), m9: email('lv9'), m10: email('lv10'), prov: email('lvprov'), sem: email('lvsemperfil'), des: email('lvdes') })) cl[k] = await clientDe(n);
  const vis = anon();
  const rpc = (c, fn, args) => c.rpc(fn, args);
  const cod = (r) => r.error?.message ?? '';
  const nega = (r) => !!r.error && (r.error.code === '42501' || /permission|sem_permissao|JWT|not allowed/i.test(r.error.message ?? ''));
  const pub = (c, pai, texto, citados = []) => rpc(c, 'livro_publicar', { p_pai: pai, p_texto: texto, p_citados: citados });
  const acesso = async (c) => (await rpc(c, 'livro_acesso')).data;
  const topicos = async (c, args = {}) => (await rpc(c, 'livro_listar_topicos', args)).data ?? [];
  const avisosDe = async (id) => (await admin.from('notifications').select('mensagem,link_destino,titulo,created_at,id').eq('usuario_id_alvo', id).eq('titulo', 'Livro de reclamações').order('created_at')).data ?? [];

  // ── Regras puras (espelho da tela) ──
  ok(JSON.stringify([...PERFIS_QUE_ESCREVEM]) === JSON.stringify(['SINDICO', 'SUBSINDICO', 'CONSELHO', 'MORADOR']), `${T} perfis que escrevem: só Síndico, Subsíndico, Conselho, Morador`);
  ok(JSON.stringify([...PERFIS_QUE_APAGAM]) === JSON.stringify(['SINDICO', 'ADM']), `${T} perfis que apagam: só Síndico e ADM`);
  ok(erroDoLivro({ message: 'texto_curto' }).includes('10 caracteres') && erroDoLivro({ message: 'x', code: '42501' }).includes('permissão') && erroDoLivro({ message: 'xyz' }).includes('Tente de novo'), `${T} erros do banco viram português claro`);
  ok(MOTIVOS_REMOCAO.length === 5, `${T} motivos de remoção: lista fechada de 5`);
  // Nenhuma regra do livro usa tem_perfil_operacao() nem is_admin() (inclui Zelador e Subsíndico): confere o SQL.
  const sql = fs.readFileSync(new URL('../../supabase/migrations/0043_livro_de_reclamacoes.sql', import.meta.url), 'utf8')
    .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
  ok(!/tem_perfil_operacao\s*\(/.test(sql) && !/is_admin\s*\(/.test(sql), `${T} a migração não usa tem_perfil_operacao() nem is_admin()`);
  const dirLivro = new URL('../../src/app/livro/', import.meta.url);
  const fontesTela = fs.existsSync(dirLivro) ? fs.readdirSync(dirLivro, { recursive: true }).filter((f) => String(f).endsWith('.tsx')).map((f) => fs.readFileSync(new URL(String(f), dirLivro), 'utf8')).join('') : '';
  ok(fontesTela.length > 0 && !/dangerouslySetInnerHTML/.test(fontesTela), `${T} nenhuma tela do livro usa dangerouslySetInnerHTML`);

  // ── Interruptor ──
  const { data: cfg } = await admin.from('livro_config').select('modo').eq('id', 1).single();
  ok(cfg.modo === 'DESLIGADO', `${T} o livro começa DESLIGADO`);
  const papeisConta = { sind: 'SINDICO', sub: 'SUBSINDICO', adm: 'ADM', cons: 'CONSELHO', port: 'PORTARIA', zel: 'ZELADOR', m1: 'MORADOR' };
  for (const m of ['DESLIGADO', 'EQUIPE', 'ABERTO']) {
    await modo(m);
    let bate = true; const quebras = [];
    for (const [k, role] of Object.entries(papeisConta)) {
      const a = await acesso(cl[k]);
      if (a.podeLer !== modoAdmiteLeitura(m, role) || a.podeEscrever !== modoAdmiteEscrita(m, role)) { bate = false; quebras.push(`${role}`); }
    }
    ok(bate, `${T} modo ${m}: quem lê e quem escreve no banco = regra da tela ${quebras.join(',')}`);
  }
  await modo('DESLIGADO');
  const semAcesso = async (c, rotulo, devePoder = false) => {
    const a = await acesso(c);
    ok(a?.podeLer === devePoder, `${T} DESLIGADO: ${rotulo} ${devePoder ? 'lê' : 'não lê'}`);
  };
  for (const [k, r] of [['sind', 'Síndico'], ['adm', 'ADM'], ['cons', 'Conselho'], ['m1', 'Morador'], ['zel', 'Zelador']]) await semAcesso(cl[k], r);
  ok((await rpc(cl.sind, 'livro_listar_topicos', {})).data.length === 0 && nega(await pub(cl.sind, null, 'QA livro texto no modo desligado')), `${T} DESLIGADO: nem o Síndico lê ou escreve (RPC)`);
  ok((await acesso(cl.sind)).podeAlterarModo === true && (await acesso(cl.adm)).podeAlterarModo === true, `${T} Síndico e ADM mudam o interruptor mesmo desligado`);
  for (const k of ['sub', 'cons', 'm1', 'zel', 'port']) ok(nega(await rpc(cl[k], 'livro_definir_modo', { p_modo: 'ABERTO' })), `${T} ${papeisConta[k]} não muda o interruptor`);
  ok(nega(await rpc(vis, 'livro_definir_modo', { p_modo: 'ABERTO' })), `${T} visitante não muda o interruptor`);
  ok(cod(await rpc(cl.sind, 'livro_definir_modo', { p_modo: 'QUALQUER' })).includes('modo_invalido'), `${T} modo fora da lista é recusado`);
  ok((await rpc(cl.sind, 'livro_definir_modo', { p_modo: 'EQUIPE' })).data?.modo === 'EQUIPE', `${T} Síndico liga em EQUIPE`);
  // Histórico mais novo primeiro: não depende de uso manual anterior da tela.
  const { data: logModo } = await admin.from('audit_logs').select('acao,modulo,detalhes,created_at').eq('modulo', 'LIVRO').like('acao', 'Alterou o modo%').order('created_at', { ascending: false });
  ok(logModo?.length >= 1 && logModo[0].detalhes.para === 'EQUIPE' && logModo[0].detalhes.de === 'DESLIGADO', `${T} a mudança do interruptor fica no histórico (de/para, sem texto livre)`);
  // EQUIPE: REST direto também respeita o modo.
  const colunas = 'id,texto';
  ok((await cl.m1.from('livro_mensagens').select(colunas)).data?.length === 0, `${T} EQUIPE: Morador não lê a tabela (REST)`);
  ok((await rpc(cl.m1, 'livro_citaveis')).data?.length === 0 && nega(await pub(cl.m1, null, 'QA livro morador no modo equipe')), `${T} EQUIPE: Morador não escreve`);
  ok((await rpc(cl.zel, 'livro_listar_topicos', {})).data.length === 0 && (await rpc(cl.port, 'livro_listar_topicos', {})).data.length === 0, `${T} EQUIPE: Zelador e Portaria ainda não leem`);
  // M-2: em EQUIPE, quem ainda não pode ler não recebe aviso de citação; em ABERTO recebe.
  for (const k of ['cons']) await rpc(cl[k], 'livro_dar_ciencia');
  const refEq = (await rpc(cl.cons, 'livro_citaveis')).data.find((x) => x.rotulo === 'Unidade Q-912').ref;
  const tEq = await pub(cl.cons, null, 'QA livro citação em modo equipe a quem ainda não lê', [refEq]);
  ok(!tEq.error && (await avisosDe(lv2)).length === 0, `${T} M-2: modo EQUIPE, Morador citado NÃO recebe aviso (${(await avisosDe(lv2)).length})`);
  // M-3 (0044): a trava de liberação saiu; Síndico e ADM abrem direto, os demais não. O Livro segue em ABERTO como antes (o teste seguinte reaplica o modo).
  for (const k of ['sub', 'cons', 'm1', 'zel', 'port']) ok(nega(await rpc(cl[k], 'livro_definir_modo', { p_modo: 'ABERTO' })), `${T} M-3: ${papeisConta[k]} não abre o Livro`);
  ok((await admin.from('livro_config').select('modo').eq('id', 1).single()).data.modo === 'EQUIPE', `${T} M-3: as tentativas negadas não mudaram o modo`);
  ok(!(await rpc(cl.adm, 'livro_definir_modo', { p_modo: 'ABERTO' })).error && (await admin.from('livro_config').select('modo').eq('id', 1).single()).data.modo === 'ABERTO', `${T} M-3: ADM abre o Livro sem liberação prévia`);
  ok(!(await rpc(cl.adm, 'livro_definir_modo', { p_modo: 'EQUIPE' })).error, `${T} M-3: ADM volta para EQUIPE`);
  ok(!(await rpc(cl.sind, 'livro_definir_modo', { p_modo: 'ABERTO' })).error, `${T} M-3: Síndico abre o Livro sem liberação prévia`);
  const tAb = await pub(cl.cons, null, 'QA livro citação depois que o livro abriu a todos', [refEq]);
  ok(!tAb.error && (await avisosDe(lv2)).filter((a) => a.link_destino === `/livro/${tAb.data.id}`).length === 1, `${T} M-2: em ABERTO, o Morador citado passa a receber o aviso`);
  await modo('ABERTO');

  // ── Ciência das regras ──
  ok(cod(await pub(cl.m1, null, 'QA livro primeiro tópico sem ciência')).includes('sem_ciencia'), `${T} sem ciência das regras ninguém escreve`);
  for (const k of ['adm', 'zel', 'port', 'prov']) ok(nega(await rpc(cl[k], 'livro_dar_ciencia')), `${T} ${k === 'prov' ? 'Provisório' : papeisConta[k]} não dá ciência (não escreve)`);
  for (const k of ['sind', 'sub', 'cons', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10']) await rpc(cl[k], 'livro_dar_ciencia');
  ok((await acesso(cl.m1)).cienciaOk === true, `${T} ciência registrada`);

  // ── Leitura por perfil ──
  const t1 = await pub(cl.m1, null, 'QA livro tópico do morador um para todos lerem');
  ok(!t1.error && t1.data?.id, `${T} Morador publica tópico ${t1.error?.message ?? ''}`);
  const idT1 = t1.data.id;
  const { data: rowT1 } = await admin.from('livro_mensagens').select('*').eq('id', idT1).single();
  ok(rowT1.autor_id === lv1 && rowT1.autor_nome === 'QA lv1' && rowT1.autor_unidade === 'Q-911' && rowT1.autor_papel === 'MORADOR', `${T} nome, unidade e perfil vêm do servidor`);
  for (const [k, rot] of [['sind', 'Síndico'], ['sub', 'Subsíndico'], ['adm', 'ADM'], ['cons', 'Conselho'], ['m2', 'outro Morador'], ['zel', 'Zelador'], ['port', 'Portaria']]) {
    const l = await topicos(cl[k]);
    ok(l.some((x) => x.id === idT1 && x.autorNome === 'QA lv1' && x.autorUnidade === 'Q-911'), `${T} ${rot} lê o tópico com nome e unidade`);
  }
  // Sem ids internos no que o navegador recebe.
  const chaves = Object.keys((await topicos(cl.m2))[0]);
  ok(!chaves.some((c) => /autorId|usuario|unitId|autor_id/i.test(c)) && chaves.includes('minha'), `${T} a resposta da API não traz id de autor ou de conta`);
  ok((await topicos(cl.m1)).find((x) => x.id === idT1).minha === true && (await topicos(cl.m2)).find((x) => x.id === idT1).minha === false, `${T} "minha" marca só as mensagens do próprio`);
  // Quem não lê nada: provisório, sem perfil, desativado (com sessão antiga), visitante.
  for (const [k, rot] of [['prov', 'Provisório'], ['sem', 'Conta sem perfil']]) {
    ok((await acesso(cl[k])).podeLer === false && (await topicos(cl[k])).length === 0 && (await cl[k].from('livro_mensagens').select(colunas)).data?.length === 0 && nega(await pub(cl[k], null, 'QA livro texto de quem não pode')), `${T} ${rot}: não lê (RPC e REST) e não escreve`);
  }
  await admin.from('profiles').update({ desativado_em: new Date().toISOString() }).eq('id', mdes);
  ok((await acesso(cl.des)).podeLer === false && (await topicos(cl.des)).length === 0 && nega(await pub(cl.des, null, 'QA livro texto de conta desativada')), `${T} conta desativada (sessão ainda válida) não lê nem escreve`);
  const visL = await rpc(vis, 'livro_listar_topicos', {});
  ok(!!visL.error && !visL.data, `${T} visitante: RPC negada`);
  const visR = await vis.from('livro_mensagens').select(colunas);
  ok(!!visR.error || (visR.data ?? []).length === 0, `${T} visitante: REST sem linhas`);
  for (const fn of ['livro_acesso', 'livro_citaveis', 'livro_obter_topico', 'livro_registro_remocoes', 'livro_remover', 'livro_sinalizar', 'livro_publicar']) {
    const r = await rpc(vis, fn, fn === 'livro_obter_topico' ? { p_id: idT1 } : fn === 'livro_remover' || fn === 'livro_sinalizar' ? { p_mensagem: idT1 } : fn === 'livro_publicar' ? { p_pai: null, p_texto: 'QA livro visitante tentando', p_citados: [] } : {});
    ok(!!r.error, `${T} visitante não executa ${fn}`);
  }
  // Zelador desativado não lê nada.
  await admin.from('profiles').update({ desativado_em: new Date().toISOString() }).eq('id', E.zel);
  ok((await acesso(cl.zel)).podeLer === false && (await topicos(cl.zel)).length === 0, `${T} Zelador desativado não lê`);
  await admin.from('profiles').update({ desativado_em: null }).eq('id', E.zel);
  ok((await acesso(cl.zel)).podeLer === true, `${T} Zelador ativo lê`);

  // ── Quem escreve ──
  for (const [k, rot] of [['adm', 'ADM'], ['zel', 'Zelador'], ['port', 'Portaria']]) {
    ok(nega(await pub(cl[k], null, 'QA livro tópico de quem só lê')) && nega(await pub(cl[k], idT1, 'QA livro resposta de quem só lê')), `${T} ${rot} não publica nem responde`);
    ok((await rpc(cl[k], 'livro_citaveis')).data.length === 0, `${T} ${rot} não recebe a lista de citáveis`);
    ok(nega(await rpc(cl[k], 'livro_sinalizar', { p_mensagem: idT1 })), `${T} ${rot} não usa "Avisar a gestão"`);
  }
  for (const [k, rot] of [['sind', 'Síndico'], ['sub', 'Subsíndico'], ['cons', 'Conselho']]) {
    const r = await pub(cl[k], null, `QA livro tópico do ${rot} com texto suficiente`);
    ok(!r.error, `${T} ${rot} publica ${r.error?.message ?? ''}`);
    const { data: row } = await admin.from('livro_mensagens').select('autor_unidade,autor_papel').eq('id', r.data.id).single();
    ok(row.autor_unidade === null && row.autor_papel === papeisConta[k], `${T} ${rot}: aparece pelo cargo, sem unidade`);
  }

  // ── Texto: tamanho e filtros ──
  const rod = (r) => cod(r);
  ok(rod(await pub(cl.m1, null, 'QA curto')).includes('texto_curto'), `${T} tópico com menos de ${LIMITES.topicoMin} caracteres é recusado`);
  ok(rod(await pub(cl.m1, null, 'x'.repeat(LIMITES.topicoMax + 1))).includes('texto_longo'), `${T} tópico com ${LIMITES.topicoMax + 1} caracteres é recusado`);
  const exato = await pub(cl.m1, null, 'QA livro ' + 'y'.repeat(LIMITES.topicoMax - 9));
  ok(!exato.error, `${T} tópico com exatamente ${LIMITES.topicoMax} caracteres passa ${exato.error?.message ?? ''}`);
  ok(rod(await pub(cl.m1, null, ' '.repeat(40))).includes('texto_vazio'), `${T} só espaços é recusado`);
  ok(rod(await pub(cl.m1, null, '​‮‏'.repeat(20))).includes('texto_vazio'), `${T} só caracteres invisíveis é recusado`);
  ok(rod(await pub(cl.m1, null, null)).includes('texto_vazio'), `${T} texto nulo é recusado`);
  ok(rod(await pub(cl.m1, null, 'QA livro meu CPF é 123.456.789-09 ok')).includes('dado_pessoal') && rod(await pub(cl.m1, null, 'QA livro CPF 12345678909 sem pontos')).includes('dado_pessoal'), `${T} CPF no texto é recusado`);
  ok(rod(await pub(cl.m1, null, 'QA livro cnpj 12.345.678/0001-95 aqui')).includes('dado_pessoal'), `${T} CNPJ no texto é recusado`);
  ok(rod(await pub(cl.m1, null, 'QA livro escreva para fulano@exemplo.com hoje')).includes('dado_pessoal'), `${T} e-mail no texto é recusado`);
  const html = await pub(cl.m1, null, 'QA livro <script>alert(1)</script> <b>negrito</b> e ‮direção invertida');
  ok(!html.error, `${T} HTML no texto não é recusado: vira texto puro ${html.error?.message ?? ''}`);
  const { data: rHtml } = await admin.from('livro_mensagens').select('texto').eq('id', html.data.id).single();
  ok(rHtml.texto.includes('<script>alert(1)</script>') && !/[‪-‮​-‏⁦-⁩]/.test(rHtml.texto), `${T} HTML fica como texto e o caractere de direção é removido no banco`);
  const zalgo = await pub(cl.m1, null, 'QA livro za' + '̀́̂̃̄̅̆'.repeat(3) + 'lgo\n\n\n\n\n\nfim');
  const { data: rZal } = await admin.from('livro_mensagens').select('texto').eq('id', zalgo.data.id).single();
  ok(!/[̀-ͯ]{3}/.test(rZal.texto) && !/\n{3}/.test(rZal.texto), `${T} acentos empilhados e quebras seguidas são domados`);
  // L4/L5: seletor de variação sozinho é vazio; emoji conta por ponto de código; NUL volta em português.
  ok(rod(await pub(cl.m7, null, '\uFE0F'.repeat(30))).includes('texto_vazio') && rod(await pub(cl.m7, null, '\uFE0E\uFE0F \u200B'.repeat(8))).includes('texto_vazio'), `${T} só seletores de variação (U+FE0F) é recusado como vazio`);
  const emojis = await pub(cl.m7, null, 'QA livro ' + '😀'.repeat(600));
  ok(!emojis.error, `${T} 600 emojis (609 pontos de código) passam, como a tela conta ${emojis.error?.message ?? ''}`);
  ok(!(await pub(cl.m7, null, 'QA livro coração ❤️ com seletor junto ao símbolo')).error, `${T} emoji com U+FE0F junto de um símbolo é aceito`);
  ok(erroDoLivro({ message: 'unsupported Unicode escape sequence' }).includes('caractere') && erroEsperado({ message: 'texto_curto' }) && !erroEsperado({ message: 'falha de rede', code: 'PGRST000' }), `${T} NUL vira mensagem em português e recusa esperada não vai ao console`);
  ok(tamanhoDoTexto('😀😀') === 2 && ehUuid(idT1) && !ehUuid('lixo'), `${T} contador por pontos de código e validação de uuid na URL`);
  const rep1 = await pub(cl.m2, idT1, 'QA livro resposta com texto novo');
  ok(!rep1.error, `${T} resposta de 1 a 500 caracteres passa ${rep1.error?.message ?? ''}`);
  ok(rod(await pub(cl.m2, idT1, 'z'.repeat(LIMITES.respostaMax + 1))).includes('texto_longo'), `${T} resposta com ${LIMITES.respostaMax + 1} caracteres é recusada`);
  ok(rod(await pub(cl.m2, rep1.data.id, 'QA livro resposta a resposta')).includes('resposta_a_resposta'), `${T} resposta a resposta é recusada pelo banco`);
  ok(rod(await pub(cl.m2, '00000000-0000-0000-0000-000000000000', 'QA livro tópico fantasma')).includes('topico_inexistente'), `${T} resposta a tópico inexistente é recusada`);
  const rptRep = await pub(cl.m2, idT1, 'QA livro resposta repetida em seguida');
  ok(!rptRep.error && rod(await pub(cl.m2, idT1, 'QA livro resposta repetida em seguida')).includes('texto_repetido'), `${T} o mesmo texto em 1 minuto é recusado`);
  ok(rod(await pub(cl.m2, idT1, '   ')).includes('texto_vazio'), `${T} resposta vazia é recusada`);
  // Tópico removido não aceita resposta (testado na seção de remoção).

  // ── Escrita direta e forjada ──
  const forja = await cl.m1.from('livro_mensagens').insert({ autor_id: lv2, autor_nome: 'Síndico Falso', autor_papel: 'SINDICO', texto: 'QA livro forjado direto na tabela', removida_em: null });
  ok(!!forja.error, `${T} INSERT direto em livro_mensagens (autor, nome e perfil forjados) é negado`);
  const forjaNotif = await cl.sind.from('notifications').insert({ titulo: 'Livro de reclamações', mensagem: 'Você foi citado no Livro', tipo: 'GERAL', usuario_id_alvo: lv1, link_destino: '/livro' });
  const forjaNotifM = await cl.m2.from('notifications').insert({ titulo: 'QA falso', mensagem: 'QA falso', tipo: 'GERAL', usuario_id_alvo: lv1 });
  ok(!!forjaNotif.error && !!forjaNotifM.error, `${T} INSERT direto em notifications com usuario_id_alvo é negado (até para o Síndico)`);
  const tabelas = ['livro_mensagens', 'livro_citacoes', 'livro_remocoes', 'livro_sinalizacoes', 'livro_ciencia', 'livro_config', 'livro_segredo'];
  const clientes = { Síndico: cl.sind, ADM: cl.adm, Subsíndico: cl.sub, Conselho: cl.cons, Morador: cl.m1, Zelador: cl.zel, Portaria: cl.port, Visitante: vis };
  for (const t of tabelas) {
    let todosNegados = true; const furos = [];
    for (const [rot, c] of Object.entries(clientes)) {
      const linha = t === 'livro_config' ? { modo: 'ABERTO' } : t === 'livro_ciencia' ? { usuario_id: lv1, versao: 1 } : { id: '00000000-0000-0000-0000-000000000001' };
      const a = await c.from(t).insert(linha);
      const b = await c.from(t).update({ id: '00000000-0000-0000-0000-000000000002' }).not('id', 'is', null);
      const d = await c.from(t).delete().not('id', 'is', null);
      if (!a.error || !b.error || !d.error) { todosNegados = false; furos.push(rot); }
    }
    ok(todosNegados, `${T} ${t}: INSERT, UPDATE e DELETE direto negados para todos, inclusive Síndico e ADM ${furos.join(',')}`);
  }
  ok(!!(await cl.sind.from('livro_segredo').select('valor')).error && !!(await cl.sind.from('livro_config').select('modo')).error, `${T} sal dos códigos e a tabela do interruptor não são lidos pelo navegador`);
  const { data: cf2 } = await admin.from('livro_config').select('modo').eq('id', 1).single();
  ok(cf2.modo === 'ABERTO', `${T} nenhuma tentativa direta mudou o interruptor`);
  ok((await cl.m2.from('livro_mensagens').select('autor_id').limit(1)).error !== null, `${T} a coluna autor_id não é legível pelo navegador`);
  ok((await cl.sind.from('livro_citacoes').select('alvo_usuario_id').limit(1)).error !== null, `${T} o alvo interno da citação não é legível pelo navegador`);

  // ── Citáveis e citação ──
  const lista = (await rpc(cl.m1, 'livro_citaveis')).data;
  const rotulos = lista.map((x) => x.rotulo);
  ok(Object.keys(lista[0]).sort().join() === 'ref,rotulo,tipo', `${T} a lista de citáveis só traz código, tipo e rótulo`);
  ok(rotulos.includes('Unidade Q-912') && rotulos.includes('Unidade R-982') && rotulos.some((r) => r.startsWith('Síndico')) && rotulos.some((r) => r.startsWith('Subsíndico')) && rotulos.some((r) => r.startsWith('Conselho')), `${T} citáveis: unidades com conta, Síndico, Subsíndico e Conselho`);
  ok(!rotulos.includes('Unidade R-981') && !rotulos.includes('Unidade Q-911'), `${T} unidade sem conta e a própria unidade não são citáveis`);
  ok(!rotulos.some((r) => /Administradora|ADM|Zelador|Portaria|lvadm|lvport|Provis/i.test(r)) && !rotulos.some((r) => /Q-916|lvprov/.test(r)), `${T} ADM, Zelador, Portaria, provisório e conta desativada não são citáveis`);
  ok(!lista.some((x) => x.ref.length !== 32 || x.ref.includes('-')), `${T} o código do citável é opaco (sem id de unidade nem de conta)`);
  const ref = (rot) => lista.find((x) => x.rotulo === rot || x.rotulo.startsWith(rot))?.ref;
  const refSind = ref('Síndico'), refSub = ref('Subsíndico'), refCons = ref('Conselho'), refU2 = ref('Unidade Q-912'), refUSind = ref('Unidade R-982');

  // Tópico novo para as citações (lv1 cita a unidade de lv2 e o Síndico).
  const c1 = await pub(cl.m1, null, 'QA livro tópico citando a unidade e o síndico', [refU2, refSind]);
  ok(!c1.error, `${T} publicar com citados ${c1.error?.message ?? ''}`);
  const avLv2 = (await avisosDe(lv2)).filter((a) => a.link_destino === `/livro/${c1.data.id}`);
  ok(avLv2.length === 1 && avLv2[0].mensagem === 'Sua unidade foi citada no Livro', `${T} a conta da unidade citada recebe "Sua unidade foi citada no Livro", com link ao tópico`);
  const avSind = (await avisosDe(E.sind)).filter((a) => a.mensagem === 'Você foi citado no Livro');
  ok(avSind.length === 1 && avSind[0].link_destino === `/livro/${c1.data.id}`, `${T} o Síndico citado recebe "Você foi citado no Livro"`);
  // Síndico citado por cargo E pela unidade dele: um aviso só.
  const c2 = await pub(cl.m3, null, 'QA livro tópico citando síndico por cargo e por unidade', [refSind, refUSind]);
  ok(!c2.error, `${T} cita o Síndico por cargo e pela unidade ${c2.error?.message ?? ''}`);
  const avSind2 = (await avisosDe(E.sind)).filter((a) => a.link_destino === `/livro/${c2.data.id}` && /citad/.test(a.mensagem));
  ok(avSind2.length === 1, `${T} citado por cargo e unidade na mesma mensagem: um aviso só (${avSind2.length})`);
  // Texto do aviso: fixo, sem trecho nem nome do autor.
  const todosAvisos = (await admin.from('notifications').select('mensagem,link_destino').eq('titulo', 'Livro de reclamações')).data;
  ok(todosAvisos.length > 0 && todosAvisos.every((a) => FIXOS.has(a.mensagem) && /^\/livro(\/[0-9a-f-]{36})?$/.test(a.link_destino)), `${T} todo aviso do livro tem texto fixo e link interno /livro/ID`);
  // Quem não é citável.
  const outras = (await rpc(cl.m4, 'livro_citaveis')).data;
  const refMor1 = outras.find((x) => x.rotulo === 'Unidade Q-911').ref;
  for (const [rot, forjado] of [
    ['ref inventada', 'a'.repeat(32)],
    ['id interno da unidade', uSemConta],
    ['id da conta do ADM', E.adm],
    ['id da conta do Zelador', E.zel],
    ['id da conta da Portaria', E.port],
    ['unidade sem conta', uSemConta],
  ]) ok(cod(await pub(cl.m4, null, `QA livro citando alvo inválido ${rot}`, [forjado])).includes('alvo_invalido'), `${T} citação recusada: ${rot}`);
  ok(cod(await pub(cl.sind, null, 'QA livro síndico citando a si mesmo', [refSind])).includes('alvo_invalido'), `${T} o autor não cita a si mesmo (o código dele não vale para ele)`);
  const seis = [refU2, refSind, refSub, refCons, refUSind, lista.find((x) => /Q-91[3-5]/.test(x.rotulo))?.ref].filter(Boolean);
  ok(seis.length === 6 && cod(await pub(cl.m1, null, 'QA livro tópico citando seis alvos de uma vez', seis)).includes('muitos_citados'), `${T} 6 citados: o banco recusa (máximo ${LIMITES.citadosMax})`);
  const cinco = await pub(cl.m1, null, 'QA livro tópico citando cinco alvos de uma vez', seis.slice(0, 5));
  ok(!cinco.error, `${T} 5 citados passam ${cinco.error?.message ?? ''}`);
  const repetidos = await pub(cl.m1, null, 'QA livro tópico com citado repetido duas vezes', [refSub, refSub, refSub]);
  const { data: citRep } = await admin.from('livro_citacoes').select('id').eq('mensagem_id', repetidos.data?.id);
  ok(!repetidos.error && citRep.length === 1, `${T} o mesmo citado repetido vale uma citação`);
  // Digitar nome no texto não avisa ninguém.
  const antes = (await avisosDe(lv3)).length;
  await pub(cl.m1, null, 'QA livro oi vizinho QA lv3 da Unidade Q-913 aqui @lv3 @QA lv3');
  ok((await avisosDe(lv3)).length === antes, `${T} digitar o nome ou "@" no texto não avisa ninguém`);
  // Um aviso por pessoa por tópico enquanto não lido; depois de lido, avisa de novo.
  const top = await pub(cl.m2, null, 'QA livro tópico para testar o agrupamento de avisos');
  const nSub0 = (await avisosDe(E.sub)).length;
  await pub(cl.m1, top.data.id, 'QA livro primeira citação ao subsíndico', [refSub]);
  await pub(cl.m3, top.data.id, 'QA livro segunda citação ao subsíndico', [refSub]);
  const nSub1 = (await avisosDe(E.sub)).length;
  ok(nSub1 === nSub0 + 1, `${T} citado de novo no mesmo tópico sem ter lido: não cria outro aviso (${nSub1 - nSub0})`);
  const nid = (await avisosDe(E.sub)).find((a) => a.link_destino === `/livro/${top.data.id}`).id;
  await cl.sub.from('notification_reads').insert({ notification_id: nid });
  await pub(cl.m4, top.data.id, 'QA livro terceira citação depois de lido', [refSub]);
  ok((await avisosDe(E.sub)).length === nSub1 + 1, `${T} depois de lido, uma nova citação avisa de novo`);
  // Resposta ao tópico: avisa o dono (agrupado) e não repete para quem foi citado na mesma mensagem.
  const avDono = (await avisosDe(lv2)).filter((a) => a.link_destino === `/livro/${top.data.id}`);
  ok(avDono.filter((a) => a.mensagem === 'Há novas respostas no seu tópico').length === 1, `${T} o dono do tópico recebe "Há novas respostas no seu tópico" uma vez enquanto não lido`);
  const top2 = await pub(cl.m2, null, 'QA livro tópico do lv2 para testar resposta com citação');
  await pub(cl.m3, top2.data.id, 'QA livro resposta citando o dono do tópico', [outras.find((x) => x.rotulo === 'Unidade Q-912')?.ref ?? (await rpc(cl.m3, 'livro_citaveis')).data.find((x) => x.rotulo === 'Unidade Q-912').ref]);
  const avTop2 = (await avisosDe(lv2)).filter((a) => a.link_destino === `/livro/${top2.data.id}`);
  ok(avTop2.length === 1 && avTop2[0].mensagem === 'Sua unidade foi citada no Livro', `${T} resposta que cita o dono do tópico: só o aviso de citação, sem "novas respostas"`);
  const antesProprio = (await avisosDe(lv2)).length;
  await pub(cl.m2, top2.data.id, 'QA livro o dono respondendo o próprio tópico');
  ok((await avisosDe(lv2)).length === antesProprio, `${T} quem responde o próprio tópico não avisa a si mesmo`);
  // Resumo à gestão: Síndico e ADM, no máximo um por dia.
  const resSind = (await avisosDe(E.sind)).filter((a) => a.mensagem === 'Há novas mensagens no Livro');
  const resAdm = (await avisosDe(E.adm)).filter((a) => a.mensagem === 'Há novas mensagens no Livro');
  ok(resSind.length === 1 && resAdm.length === 1, `${T} resumo à gestão: Síndico e ADM recebem um aviso por dia (${resSind.length}/${resAdm.length})`);
  for (const [id, rot] of [[E.sub, 'Subsíndico'], [E.cons, 'Conselho'], [lv1, 'Morador']]) ok(!(await avisosDe(id)).some((a) => a.mensagem === 'Há novas mensagens no Livro'), `${T} ${rot} não recebe o resumo da gestão`);
  for (const [id, rot] of [[E.zel, 'Zelador'], [E.port, 'Portaria'], [E.adm, 'ADM']]) ok(!(await avisosDe(id)).some((a) => /citad|respostas|removida/.test(a.mensagem)), `${T} ${rot} não recebe aviso de citação, resposta nem remoção`);
  // Autor não recebe aviso das próprias citações.
  ok(!(await avisosDe(lv1)).some((a) => a.link_destino === `/livro/${c1.data.id}`), `${T} o autor não avisa a si mesmo`);
  void refMor1; void c2;

  // ── Frequência ──
  for (let i = 0; i < 10; i++) { const r = await pub(cl.m5, null, `QA livro mensagem de frequência número ${i + 1}`); if (r.error) console.log('   erro inesperado', r.error.message); }
  ok(cod(await pub(cl.m5, null, 'QA livro a décima primeira mensagem na hora')).includes('limite_hora'), `${T} a 11ª mensagem na mesma hora é recusada`);
  const fill = Array.from({ length: 40 }, (_, i) => ({ autor_id: lv4, autor_nome: 'QA lv4', autor_unidade: 'Q-914', autor_papel: 'MORADOR', texto: `QA livro enchimento diário ${i + 100}`, criada_em: horas(3), ultima_atividade_em: horas(3) }));
  await admin.from('livro_mensagens').insert(fill);
  ok(cod(await pub(cl.m4, null, 'QA livro a mensagem número quarenta e um')).includes('limite_dia'), `${T} a 41ª mensagem no dia é recusada`);
  // 15 avisos de citação por dia: Subsíndico cita 3x5 e depois mais um.
  const cinco2 = (await rpc(cl.sub, 'livro_citaveis')).data.slice(0, 5).map((x) => x.ref);
  let citOk = cinco2.length === 5;
  for (let i = 0; i < 3; i++) citOk = citOk && !(await pub(cl.sub, null, `QA livro rodada de citações número ${i + 1} do subsíndico`, cinco2)).error;
  ok(citOk && cod(await pub(cl.sub, null, 'QA livro rodada de citações número quatro', [cinco2[0]])).includes('limite_citacoes'), `${T} acima de 15 citações por dia o banco recusa`);

  // ── Limite de 200 respostas e paginação ──
  const tcheio = await pub(cl.cons, null, 'QA livro tópico que vai encher de respostas');
  await admin.from('livro_mensagens').insert(Array.from({ length: LIMITES.respostasPorTopico }, (_, i) => ({ pai_id: tcheio.data.id, autor_id: null, autor_nome: 'QA lv3', autor_unidade: 'Q-913', autor_papel: 'MORADOR', texto: `QA livro resposta ${i}`, criada_em: dias(2) })));
  const { data: ct } = await admin.from('livro_mensagens').select('n_respostas').eq('id', tcheio.data.id).single();
  ok(ct.n_respostas === 200, `${T} o gatilho mantém n_respostas (${ct.n_respostas})`);
  ok(cod(await pub(cl.m2, tcheio.data.id, 'QA livro a resposta número duzentos e um')).includes('topico_cheio'), `${T} a 201ª resposta recebe "chegou ao limite"`);
  // 0046: o teto de 200 conta só as NÃO removidas; removida abre vaga.
  const { data: umaResp } = await admin.from('livro_mensagens').select('id').eq('pai_id', tcheio.data.id).limit(1).single();
  await admin.from('livro_mensagens').update({ removida_em: new Date().toISOString(), removida_por: 'GESTAO', texto: '' }).eq('id', umaResp.id);
  ok(!(await pub(cl.m2, tcheio.data.id, 'QA livro resposta que ocupa a vaga da removida')).error, `${T} 0046: resposta removida libera vaga no teto de 200`);
  ok(cod(await pub(cl.m9, tcheio.data.id, 'QA livro de novo cheio depois da vaga')).includes('topico_cheio'), `${T} 0046: com 200 não removidas o tópico volta a recusar`);
  // 0046: no máximo 20 respostas por autor no mesmo tópico.
  const tauto = await pub(cl.cons, null, 'QA livro tópico para o teto de respostas por autor');
  await admin.from('livro_mensagens').insert(Array.from({ length: 20 }, (_, i) => ({ pai_id: tauto.data.id, autor_id: lv3, autor_nome: 'QA lv3', autor_unidade: 'Q-913', autor_papel: 'MORADOR', texto: `QA livro resposta do mesmo autor ${i}`, criada_em: dias(2) })));
  ok(cod(await pub(cl.m3, tauto.data.id, 'QA livro a vigésima primeira do mesmo autor')).includes('limite_respostas_autor'), `${T} 0046: a 21ª resposta do mesmo autor no tópico é recusada`);
  ok(!(await pub(cl.m10, tauto.data.id, 'QA livro outro autor responde normalmente')).error, `${T} 0046: outro autor ainda responde no mesmo tópico`);
  const p1 = (await rpc(cl.m2, 'livro_listar_respostas', { p_topico: tcheio.data.id })).data;
  ok(p1.length === 30, `${T} respostas: 30 por vez`);
  const p2 = (await rpc(cl.m2, 'livro_listar_respostas', { p_topico: tcheio.data.id, p_depois_em: p1[29].criadaEm, p_depois_id: p1[29].id })).data;
  ok(p2.length === 30 && !p2.some((x) => p1.some((y) => y.id === x.id)), `${T} respostas: a segunda página continua sem repetir (cursor por data e id)`);
  // Feed: 20 por página, ordenado por atividade; resposta sobe o tópico.
  await admin.from('livro_mensagens').insert(Array.from({ length: 25 }, (_, i) => ({ autor_id: lv3, autor_nome: 'QA lv3', autor_unidade: 'Q-913', autor_papel: 'MORADOR', texto: `QA livro tópico antigo número ${i + 100}`, criada_em: dias(5), ultima_atividade_em: new Date(Date.now() - 5 * 864e5 - i * 1000).toISOString() })));
  const f1 = await topicos(cl.m2);
  ok(f1.length === 20, `${T} o feed traz 20 tópicos por página`);
  const f2 = await topicos(cl.m2, { p_antes_em: f1[19].ultimaAtividadeEm, p_antes_id: f1[19].id });
  ok(f2.length > 0 && !f2.some((x) => f1.some((y) => y.id === x.id)), `${T} a página seguinte do feed não repete tópicos`);
  const ordenado = f1.every((x, i) => i === 0 || new Date(f1[i - 1].ultimaAtividadeEm) >= new Date(x.ultimaAtividadeEm));
  ok(ordenado, `${T} o feed vem por atividade mais recente`);
  const { data: antigo } = await admin.from('livro_mensagens').select('id').eq('texto', 'QA livro tópico antigo número 124').single();
  await pub(cl.m2, antigo.id, 'QA livro uma resposta que traz o tópico antigo ao topo');
  ok((await topicos(cl.m2))[0].id === antigo.id, `${T} uma resposta sobe o tópico para o topo do feed`);
  ok((await rpc(cl.m2, 'livro_obter_topico', { p_id: rep1.data.id })).data === null, `${T} obter_topico não devolve resposta como se fosse tópico`);

  // ── Remoção ──
  const alvo = await pub(cl.m6, null, 'QA livro mensagem que a gestão vai remover do livro');
  const alvoId = alvo.data.id;
  const resp = await pub(cl.m2, alvoId, 'QA livro resposta ao tópico que será removido');
  for (const [k, rot] of [['sub', 'Subsíndico'], ['cons', 'Conselho'], ['m2', 'outro Morador'], ['zel', 'Zelador'], ['port', 'Portaria']]) {
    ok(nega(await rpc(cl[k], 'livro_remover', { p_mensagem: alvoId, p_motivo: 'OFENSA' })), `${T} ${rot} não remove mensagem de outro (403)`);
  }
  ok(nega(await rpc(vis, 'livro_remover', { p_mensagem: alvoId, p_motivo: 'OFENSA' })) || !!(await rpc(vis, 'livro_remover', { p_mensagem: alvoId, p_motivo: 'OFENSA' })).error, `${T} visitante não remove`);
  ok(cod(await rpc(cl.sind, 'livro_remover', { p_mensagem: alvoId, p_motivo: 'porque eu quero' })).includes('motivo_invalido') && cod(await rpc(cl.sind, 'livro_remover', { p_mensagem: alvoId, p_motivo: 'x'.repeat(500) })).includes('motivo_invalido') && cod(await rpc(cl.sind, 'livro_remover', { p_mensagem: alvoId })).includes('motivo_invalido'), `${T} motivo fora da lista, longo ou ausente é recusado`);
  ok((await admin.from('livro_mensagens').select('removida_em').eq('id', alvoId).single()).data.removida_em === null, `${T} nada foi removido pelas tentativas negadas`);
  const rm = await rpc(cl.sind, 'livro_remover', { p_mensagem: alvoId, p_motivo: 'FORA_DO_ASSUNTO' });
  ok(!rm.error && rm.data.ok, `${T} Síndico remove com motivo da lista ${rm.error?.message ?? ''}`);
  const { data: rowRm } = await admin.from('livro_mensagens').select('texto,removida_em,removida_por').eq('id', alvoId).single();
  ok(rowRm.texto === '' && rowRm.removida_em && rowRm.removida_por === 'GESTAO', `${T} a mensagem fica com texto vazio, data e "GESTAO"`);
  const vm2 = (await topicos(cl.m2)).find((x) => x.id === alvoId);
  ok(vm2.removida && vm2.texto === '' && vm2.removidaPor === 'GESTAO' && vm2.textoOriginal === null && vm2.citados.length === 0, `${T} outro Morador vê só "removida pela gestão": sem texto, motivo nem quem removeu`);
  ok(!JSON.stringify(vm2).includes('FORA_DO_ASSUNTO') && !JSON.stringify(vm2).includes('Síndico'), `${T} a resposta da API não revela o motivo nem quem removeu`);
  const vAut = (await topicos(cl.m6)).find((x) => x.id === alvoId);
  ok(vAut.textoOriginal?.includes('que a gestão vai remover'), `${T} o autor vê o próprio texto por 90 dias`);
  for (const [k, rot] of [['sub', 'Subsíndico'], ['cons', 'Conselho'], ['adm', 'ADM'], ['sind', 'Síndico']]) {
    ok((await topicos(cl[k])).find((x) => x.id === alvoId).textoOriginal?.includes('que a gestão vai remover'), `${T} ${rot} lê o texto removido`);
  }
  for (const [k, rot] of [['zel', 'Zelador'], ['port', 'Portaria'], ['m3', 'Morador comum']]) ok((await topicos(cl[k])).find((x) => x.id === alvoId).textoOriginal === null, `${T} ${rot} não lê o texto removido`);
  ok(cod(await pub(cl.m3, alvoId, 'QA livro resposta ao tópico removido')).includes('topico_removido'), `${T} tópico removido não aceita resposta`);
  const rm2 = await rpc(cl.adm, 'livro_remover', { p_mensagem: alvoId, p_motivo: 'OFENSA' });
  ok(!rm2.error && rm2.data.jaRemovida === true, `${T} remover duas vezes não duplica`);
  const { data: regs } = await admin.from('livro_remocoes').select('*').eq('mensagem_id', alvoId);
  ok(regs.length === 1 && regs[0].removido_por_papel === 'SINDICO' && regs[0].motivo === 'FORA_DO_ASSUNTO' && regs[0].autor_era_quem_removeu === false, `${T} um registro só, com quem removeu, papel e motivo`);
  ok(new Date(regs[0].texto_expira_em) - new Date(regs[0].removida_em) > 89.9 * 864e5 && new Date(regs[0].texto_expira_em) - new Date(regs[0].removida_em) < 90.1 * 864e5, `${T} o texto fica retido por 90 dias`);
  ok((await avisosDe(lv6)).filter((a) => a.mensagem === 'Sua mensagem foi removida pela gestão').length === 1, `${T} o autor recebe um só aviso de remoção`);
  const { data: logRem } = await admin.from('audit_logs').select('acao,detalhes').eq('modulo', 'LIVRO').eq('acao', 'Removeu uma mensagem do Livro').filter('detalhes->>mensagemId', 'eq', alvoId);
  ok(logRem.length === 1 && !JSON.stringify(logRem[0].detalhes).includes('QA livro') && ['mensagemId', 'motivo', 'tipo'].every((k) => k in logRem[0].detalhes), `${T} a auditoria registra a remoção só com códigos, sem o texto`);
  ok((await rpc(cl.cons, 'livro_obter_topico', { p_id: alvoId })).data.removida === true, `${T} o tópico removido continua listado como removido`);
  // Autor apaga a própria.
  const meu = await pub(cl.m3, null, 'QA livro mensagem que o autor vai apagar sozinho');
  const rp = await rpc(cl.m3, 'livro_remover', { p_mensagem: meu.data.id, p_motivo: 'OFENSA' });
  const { data: rpReg } = await admin.from('livro_remocoes').select('motivo,autor_era_quem_removeu').eq('mensagem_id', meu.data.id).single();
  ok(!rp.error && rpReg.motivo === 'AUTOR' && rpReg.autor_era_quem_removeu === true, `${T} o autor remove a própria (registrada como "pelo autor", motivo ignorado)`);
  ok((await topicos(cl.m2)).find((x) => x.id === meu.data.id).removidaPor === 'AUTOR' && !(await avisosDe(lv3)).some((a) => a.mensagem === 'Sua mensagem foi removida pela gestão'), `${T} remoção pelo autor aparece como "pelo autor" e não gera aviso`);
  ok((await admin.from('audit_logs').select('id').eq('acao', 'Removeu a própria mensagem do Livro')).data.length >= 1, `${T} remoção pelo autor também fica no histórico`);
  // ADM remove; Síndico remove a própria sem motivo.
  const doAdm = await pub(cl.m3, null, 'QA livro mensagem que a administradora vai remover');
  ok(!(await rpc(cl.adm, 'livro_remover', { p_mensagem: doAdm.data.id, p_motivo: 'DADO_PESSOAL' })).error, `${T} ADM remove qualquer mensagem`);
  const doSind = await pub(cl.sind, null, 'QA livro mensagem do próprio síndico que ele apaga');
  const rps = await rpc(cl.sind, 'livro_remover', { p_mensagem: doSind.data.id });
  ok(!rps.error, `${T} Síndico apaga a própria mensagem sem motivo`);
  ok(nega(await rpc(cl.m1, 'livro_remover', { p_mensagem: doSind.data.id })) || (await rpc(cl.m1, 'livro_remover', { p_mensagem: doSind.data.id })).data?.jaRemovida === true, `${T} outro Morador não mexe na mensagem de outro`);

  // ── Contrapeso: a mensagem citava quem apagou ──
  const critica = await pub(cl.m6, null, 'QA livro crítica dura ao síndico e à sua unidade', [refSind]);
  const critica2 = await pub(cl.m6, null, 'QA livro crítica citando só a unidade do síndico', [refUSind]);
  const neutra = await pub(cl.m6, null, 'QA livro mensagem que não cita o síndico');
  for (const id of [critica.data.id, critica2.data.id, neutra.data.id]) await rpc(cl.sind, 'livro_remover', { p_mensagem: id, p_motivo: 'OUTRO' });
  const flag = async (id) => (await admin.from('livro_remocoes').select('citava_quem_removeu,autor_era_quem_removeu').eq('mensagem_id', id).single()).data;
  ok((await flag(critica.data.id)).citava_quem_removeu === true && (await flag(critica2.data.id)).citava_quem_removeu === true && (await flag(neutra.data.id)).citava_quem_removeu === false, `${T} o registro marca "citava quem removeu" (por cargo e por unidade) e não marca a neutra`);
  ok((await flag(doSind.data.id)).autor_era_quem_removeu === true, `${T} o registro marca "o autor era quem removeu"`);
  const reg = await rpc(cl.cons, 'livro_registro_remocoes', {});
  const itCrit = reg.data.itens.find((i) => i.mensagemId === critica.data.id);
  ok(itCrit?.citavaQuemRemoveu === true && itCrit.textoOriginal?.includes('crítica dura') && itCrit.removidoPorPapel === 'SINDICO' && itCrit.motivo === 'OUTRO', `${T} o Conselho lê o registro com o texto, o marcador de conflito e quem removeu`);
  ok(reg.data.resumo.some((r) => r.papel === 'SINDICO' && r.total >= 3) && reg.data.resumo.some((r) => r.papel === 'AUTOR'), `${T} o registro traz a contagem dos últimos 30 dias por perfil`);
  for (const k of ['sind', 'sub', 'adm']) ok(!(await rpc(cl[k], 'livro_registro_remocoes', {})).error, `${T} ${papeisConta[k]} lê o registro de remoções`);
  for (const k of ['m1', 'm2', 'zel', 'port', 'prov', 'des']) ok(nega(await rpc(cl[k], 'livro_registro_remocoes', {})), `${T} ${k === 'prov' ? 'Provisório' : k === 'des' ? 'conta desativada' : papeisConta[k] ?? 'Morador'} não lê o registro`);
  ok(!!(await vis.rpc('livro_registro_remocoes', {})).error, `${T} visitante não lê o registro`);
  // REST: o registro não vaza para quem não é do registro e o texto original nunca sai pela tabela.
  for (const k of ['m1', 'zel', 'port']) ok((await cl[k].from('livro_remocoes').select('id,motivo')).data?.length === 0, `${T} REST: ${papeisConta[k]} lê 0 linhas de livro_remocoes`);
  ok((await cl.cons.from('livro_remocoes').select('id,motivo')).data.length > 0 && !!(await cl.cons.from('livro_remocoes').select('texto_original')).error, `${T} REST: o Conselho lê o registro, mas a coluna do texto original só sai pela função`);
  // Imutável e expira.
  ok(!!(await cl.sind.from('livro_remocoes').update({ motivo: 'OUTRO' }).eq('mensagem_id', alvoId)).error && !!(await cl.sind.from('livro_remocoes').delete().eq('mensagem_id', alvoId)).error, `${T} o registro não é editável nem apagável pelo Síndico`);
  await admin.from('livro_remocoes').update({ texto_expira_em: new Date(Date.now() - 1000).toISOString() }).eq('mensagem_id', alvoId);
  ok((await topicos(cl.m6)).find((x) => x.id === alvoId).textoOriginal === null && (await rpc(cl.cons, 'livro_obter_topico', { p_id: alvoId })).data.textoOriginal === null, `${T} depois de 90 dias o texto some da tela e da API`);
  const reg2 = await rpc(cl.cons, 'livro_registro_remocoes', {});
  ok(reg2.data.itens.find((i) => i.mensagemId === alvoId).textoOriginal === null, `${T} o registro vencido mostra os dados sem o texto`);
  ok((await admin.from('livro_remocoes').select('texto_original').eq('mensagem_id', alvoId).single()).data.texto_original === null, `${T} o texto vencido é apagado de verdade na limpeza`);

  // L3: citação de mensagem removida não é legível pela API; a de mensagem normal é.
  ok((await cl.m2.from('livro_citacoes').select('id,rotulo').eq('mensagem_id', critica.data.id)).data?.length === 0 && (await cl.cons.from('livro_citacoes').select('id').eq('mensagem_id', critica.data.id)).data?.length === 0, `${T} REST: citação de mensagem removida não aparece para ninguém`);
  ok((await cl.m2.from('livro_citacoes').select('id,rotulo').eq('mensagem_id', c1.data.id)).data?.length === 2, `${T} REST: citação de mensagem normal segue legível`);
  // L9: o autor apaga a própria mesmo depois de mudar de perfil; conta desativada não apaga.
  const pA = await pub(cl.m7, null, 'QA livro mensagem de quem vai mudar de perfil');
  const pB = await pub(cl.m7, null, 'QA livro outra mensagem de quem vai ser desativado');
  await admin.from('profiles').update({ role: 'PORTARIA' }).eq('id', lv7);
  const r9 = await rpc(cl.m7, 'livro_remover', { p_mensagem: pA.data.id });
  ok(!r9.error && (await admin.from('livro_remocoes').select('motivo').eq('mensagem_id', pA.data.id)).data[0].motivo === 'AUTOR', `${T} autor que virou Portaria ainda apaga a própria mensagem ${r9.error?.message ?? ''}`);
  ok(nega(await rpc(cl.m7, 'livro_remover', { p_mensagem: doSind.data.id })), `${T} ... mas não a de outra pessoa`);
  await admin.from('profiles').update({ desativado_em: new Date().toISOString() }).eq('id', lv7);
  ok(nega(await rpc(cl.m7, 'livro_remover', { p_mensagem: pB.data.id })), `${T} autor com conta desativada não apaga`);
  await admin.from('profiles').update({ desativado_em: null, role: 'MORADOR' }).eq('id', lv7);
  // Duplo toque em "Remover": duas chamadas ao mesmo tempo geram um registro e um aviso.
  const dup = await pub(cl.m6, null, 'QA livro mensagem do duplo toque na remoção');
  await Promise.all([1, 2, 3].map(() => rpc(cl.sind, 'livro_remover', { p_mensagem: dup.data.id, p_motivo: 'REPETIDA' })));
  ok((await admin.from('livro_remocoes').select('id').eq('mensagem_id', dup.data.id)).data.length === 1 && (await admin.from('audit_logs').select('id').eq('modulo', 'LIVRO').filter('detalhes->>mensagemId', 'eq', dup.data.id)).data.length === 1, `${T} remoções simultâneas da mesma mensagem: 1 registro e 1 linha de auditoria`);

  // ── Avisar a gestão ──
  const alvoS = await pub(cl.m6, null, 'QA livro mensagem que será sinalizada à gestão');
  const nS0 = (await avisosDe(E.sind)).filter((a) => a.mensagem === 'Há mensagens sinalizadas à gestão no Livro').length;
  const s1 = await rpc(cl.m2, 'livro_sinalizar', { p_mensagem: alvoS.data.id });
  ok(!s1.error && s1.data.jaAvisado === false, `${T} Morador toca em "Avisar a gestão"`);
  ok((await avisosDe(E.sind)).filter((a) => a.mensagem === 'Há mensagens sinalizadas à gestão no Livro').length === nS0 + 1 && (await avisosDe(E.adm)).some((a) => a.mensagem === 'Há mensagens sinalizadas à gestão no Livro'), `${T} Síndico e ADM recebem o aviso neutro`);
  const s2 = await rpc(cl.m2, 'livro_sinalizar', { p_mensagem: alvoS.data.id });
  await rpc(cl.m3, 'livro_sinalizar', { p_mensagem: alvoS.data.id });
  ok(s2.data.jaAvisado === true && (await avisosDe(E.sind)).filter((a) => a.mensagem === 'Há mensagens sinalizadas à gestão no Livro').length === nS0 + 1, `${T} o segundo toque diz "já avisado" e não repete o aviso (nem de outra pessoa)`);
  ok((await topicos(cl.m3)).some((x) => x.id === alvoS.data.id && !x.removida), `${T} sinalizar não oculta nada`);
  ok(cod(await rpc(cl.m6, 'livro_sinalizar', { p_mensagem: alvoS.data.id })).includes('mensagem_propria'), `${T} não se sinaliza a própria mensagem`);
  ok((await admin.from('notifications').select('mensagem').eq('titulo', 'Livro de reclamações').eq('mensagem', 'Há mensagens sinalizadas à gestão no Livro')).data.every((a) => a.mensagem === 'Há mensagens sinalizadas à gestão no Livro') && !JSON.stringify((await admin.from('notifications').select('*').eq('mensagem', 'Há mensagens sinalizadas à gestão no Livro')).data).includes('lv2'), `${T} o aviso da sinalização não identifica quem sinalizou`);

  // ── Revisão de segurança: M-1 (limite de "Avisar a gestão"), B-1, B-2, B-3, B-4 ──
  const alvosS = [];
  for (let i = 0; i < 6; i++) alvosS.push((await pub(cl.m8, null, `QA livro mensagem alvo de sinalização número ${i + 1}`)).data.id);
  const sins = [];
  for (const id of alvosS) sins.push(await rpc(cl.m2, 'livro_sinalizar', { p_mensagem: id }));
  ok(sins.filter((r) => !r.error).length === 4 && cod(sins[5]).includes('limite_sinalizacao'), `${T} M-1: a 6ª sinalização na hora (5ª nova) é recusada (${sins.map((r) => (r.error ? 'x' : 'ok')).join('')})`);
  ok((await avisosDe(E.sind)).filter((a) => a.mensagem === 'Há mensagens sinalizadas à gestão no Livro').length === 1 && (await avisosDe(E.adm)).filter((a) => a.mensagem === 'Há mensagens sinalizadas à gestão no Livro').length === 1, `${T} M-1: Síndico e ADM têm um só aviso agregado de sinalização enquanto não leem`);
  // B-1: normalização e novos padrões
  const dp = async (t) => cod(await pub(cl.m8, null, t)).includes('dado_pessoal');
  ok(await dp('QA livro CPF em largura total １２３.４５６.７８９-０９ aqui'), `${T} B-1: CPF em largura total é recusado`);
  ok(await dp('QA livro CPF com espaços 123 456 789 09 no texto') && await dp('QA livro CPF 123-456-789.09 misturado'), `${T} B-1: CPF com espaços e pontuação variada é recusado`);
  ok(await dp('QA livro ligue (11) 91234-5678 depois') && await dp('QA livro ligue 11 91234 5678 agora') && await dp('QA livro fixo 3333-4444 aqui'), `${T} B-1: telefone com máscara e com espaços é recusado`);
  ok(await dp('QA livro RG 12.345.678-9 do vizinho aqui'), `${T} B-1: RG é recusado`);
  ok(await dp('QA livro escreva para fulano [at] dominio.com hoje') && await dp('QA livro escreva fulano(arroba)dominio.com.br hoje') && await dp('QA livro ｆｕｌａｎｏ＠ｄｏｍｉｎｉｏ．ｃｏｍ largura'), `${T} B-1: e-mail disfarçado ("[at]", "(arroba)", largura total) é recusado`);
  const dataOk = await pub(cl.m8, null, 'QA livro o barulho foi em 12/03/2026 no apto 101 do bloco 2');
  ok(!dataOk.error, `${T} B-1: data com barra e números curtos passam ${dataOk.error?.message ?? ''}`);
  // B-1b: e-mail com espaços em volta de "@" e "."; texto comum não é recusado. Banco e tela (temDadoPessoal) concordam.
  const ruins = ['QA livro fale com fulano @ gmail . com hoje', 'QA livro fulano@gmail . com amanhã', 'QA livro fulano @gmail.com amanhã', 'QA livro FULANO  @  Hotmail . com . br ok'];
  const bons = ['QA livro às 10h30 na portaria, aviso de 18:30 também', 'QA livro o valor foi R$ 1.500,00 no mês passado', 'QA livro ocorreu em 12/03/2026 no apto 101 bloco 2', 'QA livro às 10h @ portaria. Obrigado a todos', 'QA livro vaga 33, garagem 2, carro 4 portas'];
  let paridade = true;
  for (const t of ruins) { const bd = cod(await pub(cl.m10, null, t)).includes('dado_pessoal'); if (!bd || !temDadoPessoal(t)) { paridade = false; console.log('   ruim aceito:', t, bd, temDadoPessoal(t)); } }
  ok(paridade, `${T} B-1b: e-mail com espaços em volta de "@" e "." é recusado no banco e na tela`);
  let bonsOk = true;
  for (const t of bons) { const r = await pub(cl.m10, null, t); if (r.error || temDadoPessoal(t)) { bonsOk = false; console.log('   bom recusado:', t, r.error?.message, temDadoPessoal(t)); } }
  ok(bonsOk, `${T} B-1b: hora, valor, data com barra e texto comum seguem aceitos (banco e tela)`);

  // B-2: invisíveis ampliados
  const inv = await pub(cl.m8, null, 'QA livro a\u061Cb\u2060c\u00ADd\u{E0041}e\u3164f\u115Fg\u17B4h texto\u00A0final');
  const { data: rInv } = await admin.from('livro_mensagens').select('texto').eq('id', inv.data.id).single();
  ok(rInv.texto === 'QA livro abcdefgh texto final', `${T} B-2: invisíveis (U+061C, U+2060, U+00AD, tags, Hangul, Khmer) saem e NBSP vira espaço ("${rInv.texto}")`);
  ok(limparTextoLivre('a\u061Cb\u2060c\u00ADd\u{E0041}e\u3164f\u115Fg\u17B4h') === 'abcdefgh' && limparTextoLivre('ok\u0007x') === 'okx', `${T} B-2: a limpeza da tela (textoLivre.ts) remove o mesmo`);
  ok(cod(await pub(cl.m8, null, '\u061C\u2060\u00AD\u{E0041}\u3164'.repeat(5))).includes('texto_vazio'), `${T} B-2: só esses invisíveis continua sendo texto vazio`);
  // B-3: texto vencido é apagado de verdade na listagem de tópicos
  const venc = await pub(cl.m8, null, 'QA livro mensagem cujo texto removido vai vencer');
  await rpc(cl.sind, 'livro_remover', { p_mensagem: venc.data.id, p_motivo: 'OUTRO' });
  ok((await admin.from('livro_remocoes').select('texto_original').eq('mensagem_id', venc.data.id).single()).data.texto_original !== null, `${T} B-3: antes do vencimento o texto está retido`);
  await admin.from('livro_remocoes').update({ texto_expira_em: new Date(Date.now() - 1000).toISOString() }).eq('mensagem_id', venc.data.id);
  await rpc(cl.m2, 'livro_listar_topicos', {});
  ok((await admin.from('livro_remocoes').select('texto_original').eq('mensagem_id', venc.data.id).single()).data.texto_original === null, `${T} B-3: a simples listagem do feed apaga o texto vencido de verdade`);
  // B-4: conta excluída leva o nome de quem removeu e o rótulo do citado
  const refC2 = (await rpc(cl.m8, 'livro_citaveis')).data.find((x) => x.rotulo.startsWith('Conselho') && x.rotulo.includes('lvcons2')).ref;
  const citC2 = await pub(cl.m8, null, 'QA livro mensagem citando um membro do conselho que sairá', [refC2]);
  const proprio = await pub(cl.m9, null, 'QA livro mensagem que quem sairá apagou');
  await rpc(cl.m9, 'livro_remover', { p_mensagem: proprio.data.id });
  ok((await admin.from('livro_remocoes').select('removido_por_nome').eq('mensagem_id', proprio.data.id).single()).data.removido_por_nome === 'QA lv9', `${T} B-4: antes de excluir, o registro guarda o nome de quem removeu`);
  await admin.from('units').update({ usuario_id: null }).eq('usuario_id', lv9);
  await admin.from('profiles').delete().eq('id', lv9); await admin.auth.admin.deleteUser(lv9);
  await admin.from('profiles').delete().eq('id', cons2); await admin.auth.admin.deleteUser(cons2);
  const { data: regB4 } = await admin.from('livro_remocoes').select('removido_por_nome,autor_nome').eq('mensagem_id', proprio.data.id).single();
  const { data: citB4 } = await admin.from('livro_citacoes').select('rotulo,alvo_usuario_id').eq('mensagem_id', citC2.data.id);
  ok(regB4.removido_por_nome === 'Ex-morador' && regB4.autor_nome === 'Ex-morador', `${T} B-4: conta excluída: o registro não guarda mais o nome (${regB4.removido_por_nome}/${regB4.autor_nome})`);
  ok(citB4.length === 1 && citB4[0].alvo_usuario_id === null && citB4[0].rotulo === 'Ex-membro', `${T} B-4: o rótulo do Conselho citado vira "Ex-membro" (${citB4[0]?.rotulo})`);

  // ── Conta excluída: mensagens ficam anonimizadas ──
  // Direto pelo service role: o lv5 já gastou o limite de frequência.
  await admin.from('livro_mensagens').insert({ autor_id: lv5, autor_nome: 'QA lv5', autor_unidade: 'Q-915', autor_papel: 'MORADOR', texto: 'QA livro mensagem de quem vai embora' });
  await admin.from('units').update({ usuario_id: null }).eq('usuario_id', lv5);
  await admin.from('profiles').delete().eq('id', lv5);
  await admin.auth.admin.deleteUser(lv5);
  const { data: anon5 } = await admin.from('livro_mensagens').select('autor_id,autor_nome,autor_unidade,autor_papel').eq('texto', 'QA livro mensagem de quem vai embora').single();
  ok(anon5.autor_id === null && anon5.autor_nome === 'Ex-morador' && anon5.autor_unidade === null && anon5.autor_papel === 'EX_MORADOR', `${T} conta excluída: a mensagem fica como "Ex-morador", sem unidade`);
  ok((await topicos(cl.m2)).some((x) => x.autorNome === 'Ex-morador'), `${T} o feed segue funcionando com mensagem anonimizada`);
  await admin.from('livro_mensagens').delete().eq('autor_nome', 'Ex-morador').like('texto', 'QA livro%');
  await modo('DESLIGADO');
  ok((await rpc(cl.m1, 'livro_listar_topicos', {})).data.length === 0 && (await cl.m1.from('livro_mensagens').select(colunas)).data.length === 0, `${T} DESLIGADO de novo: o livro some para todos (dados preservados)`);
  const { count } = await admin.from('livro_mensagens').select('id', { count: 'exact', head: true });
  ok(count > 50, `${T} desligar não apaga nada (${count} mensagens)`);
}

// Execução avulsa: node scripts/qa/livro.mjs (staging; apaga os dados de QA e deixa o livro DESLIGADO).
if (process.argv[1] && process.argv[1].endsWith('livro.mjs')) {
  await limparQA();
  try { await rodarLivro(); } finally { await limparQA(); }
  resumo();
}
