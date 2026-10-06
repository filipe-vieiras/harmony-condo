// Bateria de "Transferir cargo" (issue #53, migração 0037). Chamada por bateria.mjs, que já criou a equipe
// de QA (Síndico, Subsíndico, Portaria, Conselho e ADM) e as unidades Q-101..104.
// Cobre: matriz de quem executa x cargo x destino (inclusive as escaladas recusadas), trava de excluir o
// Síndico, atomicidade e concorrência, convite com cargo pendente (iniciar, cancelar, aceitar, aceite
// que falha), auditoria sem dados pessoais, avisos por usuário e RLS (profiles segue só leitura).
import { admin, anon, api, cookieDe, clientDe, criarUsuario, ok, DOMINIO, SENHA } from './lib.mjs';
import { confirmacaoValida, podeTransferirCargo, ehEmailValido } from '../../src/lib/cargos.ts';
import { descreverAuditoria } from '../../src/lib/auditoria.ts';

const email = (n) => `${n}@${DOMINIO}`;
const UUID_FALSO = '00000000-0000-4000-8000-000000000001';

export async function rodarTransferirCargo({ unidadeSemMorador }) {
  console.log('\n## J. Transferir cargo (issue #53, migração 0037)');

  // A base de teste (seed) já traz uma transferência pendente de exemplo: sai daqui para os blocos contarem só o que geram.
  await admin.from('pending_invites').delete().not('transferencia_id', 'is', null);
  await admin.from('cargo_transferencias').delete().not('id', 'is', null);
  await admin.from('audit_logs').delete().or('acao.like.Transferiu o cargo%,acao.like.Iniciou a transferência%,acao.like.Cancelou a transferência%,acao.like.Aceitou o convite e assumiu%,acao.like.A transferência do cargo%');
  await admin.from('notifications').delete().not('usuario_id_alvo', 'is', null);

  // ── Elenco ──
  const idDe = async (n) => (await admin.from('profiles').select('id').eq('email', email(n)).single()).data.id;
  const sind = await idDe('sindico'), subs = await idDe('subsindico'), adm = await idDe('adm');
  const port1 = await idDe('portaria'), cons1 = await idDe('conselho');
  const cons2 = await criarUsuario(email('conselho2'), { name: 'QA Conselho Dois', role: 'CONSELHO' });
  const port2 = await criarUsuario(email('portaria2'), { name: 'QA Portaria Dois', role: 'PORTARIA' });
  const mA = await criarUsuario(email('candidatoa'), { name: 'QA Candidato A', role: 'MORADOR' });
  const mB = await criarUsuario(email('candidatob'), { name: 'QA Candidato B', role: 'MORADOR' });
  const mC = await criarUsuario(email('candidatoc'), { name: 'QA Candidato C', role: 'MORADOR' });
  const prov = await criarUsuario(email('provisorio2'), { name: 'QA Provisório Dois', role: 'MORADOR', cadastro_validado: false });
  const adm2 = await criarUsuario(email('adm2'), { name: 'QA Administradora Dois', role: 'ADM' });
  const semPerfil = await criarUsuario(email('semperfil'), null);
  // Conselho2 mora na unidade: ao perder o cargo vira Morador VALIDADO; sem unidade (Conselho1) vira provisório.
  await admin.from('units').update({ usuario_id: cons2 }).eq('id', unidadeSemMorador);

  const todos = [sind, subs, adm, port1, cons1, cons2, port2, mA, mB, mC, prov, adm2];
  const snap = (await admin.from('profiles').select('id,role,cadastro_validado').in('id', todos)).data;
  const papel = async (id) => (await admin.from('profiles').select('role,cadastro_validado').eq('id', id).single()).data;
  const retrato = async () => JSON.stringify((await admin.from('profiles').select('id,role,cadastro_validado').in('id', todos).order('id')).data);
  const contar = async (role) => (await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', role)).count;
  const limparPendencias = async () => {
    await admin.from('pending_invites').delete().not('transferencia_id', 'is', null);
    await admin.from('cargo_transferencias').delete().not('id', 'is', null);
  };
  const restaurar = async () => {
    await limparPendencias();
    // Histórico e avisos desta bateria saem junto, para cada bloco contar só o que ele mesmo gerou.
    await admin.from('audit_logs').delete().or('acao.like.Transferiu o cargo%,acao.like.Iniciou a transferência%,acao.like.Cancelou a transferência%,acao.like.Aceitou o convite e assumiu%,acao.like.A transferência do cargo%');
    await admin.from('notifications').delete().not('usuario_id_alvo', 'is', null);
    // Quem virou Síndico/Subsíndico por um convite aceito (fora de `todos`) também volta a Morador.
    await admin.from('profiles').update({ role: 'MORADOR' }).in('role', ['SINDICO', 'SUBSINDICO']).like('email', `%@${DOMINIO}`);
    // Todos para Morador primeiro: assim os índices únicos de Síndico/Subsíndico nunca reclamam.
    await admin.from('profiles').update({ role: 'MORADOR' }).in('id', todos);
    for (const p of snap) await admin.from('profiles').update({ role: p.role, cadastro_validado: p.cadastro_validado }).eq('id', p.id);
  };

  const ck = Object.fromEntries(await Promise.all([
    ['sind', 'sindico'], ['subs', 'subsindico'], ['adm', 'adm'], ['port1', 'portaria'], ['cons1', 'conselho'],
    ['mA', 'candidatoa'], ['prov', 'provisorio2'], ['semPerfil', 'semperfil'], ['adm2', 'adm2'],
  ].map(async ([k, n]) => [k, await cookieDe(email(n))])));
  const cl = { sind: await clientDe(email('sindico')), adm: await clientDe(email('adm')), mA: await clientDe(email('candidatoa')), subs: await clientDe(email('subsindico')) };

  // Desde a 0042 quem muda de cargo (origem e destino) perde as sessões abertas e os links pendentes (M-1): depois de cada
  // transferência concluída o teste entra de novo, e as chamadas seguintes valem para a conta com o cargo NOVO.
  const NOMES_CK = { sind: 'sindico', subs: 'subsindico', adm: 'adm', port1: 'portaria', cons1: 'conselho', mA: 'candidatoa', prov: 'provisorio2', adm2: 'adm2' };
  const IDS_CK = { sind, subs, adm, port1, cons1, mA, prov, adm2 };
  const renovarSessoes = async (...envolvidos) => {
    for (const [k, n] of Object.entries(NOMES_CK)) {
      if (!envolvidos.includes(IDS_CK[k])) continue;
      ck[k] = await cookieDe(email(n));
      if (k in cl) cl[k] = await clientDe(email(n));
    }
  };
  const tr = async (cookie, cargo, origemId, destino) => {
    const r = await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie, body: { cargo, origemId, destino } });
    if (r.status === 200 && destino?.tipo === 'EXISTENTE') await renovarSessoes(origemId, destino.id);
    return r;
  };
  const ex = (id) => ({ tipo: 'EXISTENTE', id });
  // Sem e-mail nem telefone no registro (o regex de telefone ignora pedaços de UUID).
  const semDadosPessoais = (reg) => !/@|qa\.harmony|\(\d{2}\)|(?<![0-9a-f-])\d{4,5}-\d{4}(?![0-9a-f-])/i.test(JSON.stringify(reg));
  const recusou = (r, status, codigo) => r.status === status && (!codigo || r.data?.codigo === codigo);

  // ── Regras puras (as mesmas que a tela usa) ──
  ok(['TRANSFERIR', 'transferir', '  Transferir  ', 'transferír', 'TRANSFERÍR'].every(confirmacaoValida), 'confirmação aceita TRANSFERIR sem diferenciar caixa, acento ou espaços');
  ok(['', 'transf', 'transferirr', 'transferir cargo', 'CONFIRMAR'].every((t) => !confirmacaoValida(t)), 'confirmação recusa qualquer outra coisa');
  ok(podeTransferirCargo('ADM', 'SINDICO', 'x', 'y') && podeTransferirCargo('SINDICO', 'SINDICO', 'a', 'a') && !podeTransferirCargo('SINDICO', 'SINDICO', 'a', 'b') && podeTransferirCargo('SINDICO', 'CONSELHO', 'a', 'b'), 'regra da tela: ADM os quatro; Síndico só o próprio Síndico e os demais');
  ok(['SUBSINDICO', 'CONSELHO', 'PORTARIA', 'MORADOR', undefined].every((r) => !podeTransferirCargo(r, 'PORTARIA', 'a', 'b')), 'regra da tela: ninguém mais transfere');
  ok(ehEmailValido('nome@dominio.com') && !ehEmailValido('nome@dominio') && !ehEmailValido('nome dominio.com'), 'validação de e-mail da tela');

  // ── 1) Quem NÃO transfere ──
  console.log('-- quem não transfere (403, nada muda)');
  const antes = await retrato();
  for (const [nome, cookie] of [['Subsíndico', ck.subs], ['Conselho', ck.cons1], ['Portaria', ck.port1], ['Morador', ck.mA], ['Morador provisório', ck.prov], ['conta sem perfil', ck.semPerfil]]) {
    const r = await tr(cookie, 'CONSELHO', cons1, ex(mA));
    ok(recusou(r, 403, 'sem_permissao'), `${nome} NÃO transfere cargo → ${r.status} "${r.data?.error}"`);
  }
  const rv = await api('/api/usuarios/transferir-cargo', { method: 'POST', body: { cargo: 'CONSELHO', origemId: cons1, destino: ex(mA) } });
  const bloqueado = (x) => x.status === 401 || (x.status === 307 && /\/login/.test(x.location ?? ''));
  ok(bloqueado(rv), `visitante (sem sessão) é barrado → ${rv.status}`);
  for (const [nome, cookie] of [['Subsíndico', ck.subs], ['Morador', ck.mA]]) {
    const c = await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie, body: { transferenciaId: UUID_FALSO } });
    ok(c.status === 403, `${nome} NÃO cancela transferência → ${c.status}`);
  }
  ok(bloqueado(await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', body: { transferenciaId: UUID_FALSO } })), 'visitante não cancela transferência');
  ok(bloqueado(await api('/api/usuarios/transferir-cargo/aceitar', { method: 'POST' })), 'visitante não aciona o aceite');
  ok((await retrato()) === antes, 'nenhum perfil mudou');

  // As funções do banco não são chamáveis pelo navegador (só o service role executa).
  for (const [nome, c] of [['ADM', cl.adm], ['Síndico', cl.sind], ['visitante', anon()]]) {
    const r1 = await c.rpc('transferir_cargo', { p_executor: adm, p_cargo: 'CONSELHO', p_origem: cons1, p_destino: mA });
    const r2 = await c.rpc('aceitar_transferencia_cargo', { p_usuario: mA });
    const r3 = await c.rpc('cancelar_transferencia_cargo', { p_executor: adm, p_transferencia: UUID_FALSO });
    const r4 = await c.rpc('iniciar_transferencia_cargo', { p_executor: adm, p_cargo: 'CONSELHO', p_origem: cons1, p_destino_id: UUID_FALSO, p_nome: 'x y', p_email: 'x@y.zz', p_telefone: '', p_link: 'x' });
    ok([r1, r2, r3, r4].every((r) => !!r.error), `${nome} NÃO executa as funções de transferência direto pelo banco`);
  }
  ok((await retrato()) === antes, 'chamadas diretas ao banco não mudaram nada');

  // profiles continua só leitura para o cliente.
  for (const [nome, c, id] of [['Síndico', cl.sind, mA], ['ADM', cl.adm, mA], ['Morador (a si mesmo)', cl.mA, mA]]) {
    await c.from('profiles').update({ role: 'SINDICO' }).eq('id', id);
    await c.from('profiles').update({ role: 'ADM', cadastro_validado: true }).eq('id', id);
    await c.from('profiles').delete().eq('id', id);
  }
  ok((await retrato()) === antes, 'profiles segue somente leitura: UPDATE/DELETE do cliente (inclusive ADM e Síndico) não mudam nada');
  ok(!!(await cl.adm.from('profiles').insert({ id: UUID_FALSO, name: 'x', role: 'ADM', email: 'x@y.zz' })).error, 'cliente NÃO insere perfil');

  // ── 2) Escaladas recusadas ──
  console.log('-- escaladas recusadas (nada muda)');
  const casos = [
    ['ADM não cria outro ADM (destino ADM)', ck.adm, 'CONSELHO', cons1, ex(adm2), 409, 'destino_invalido'],
    ['Síndico não cria ADM (destino ADM)', ck.sind, 'CONSELHO', cons1, ex(adm), 409, 'destino_invalido'],
    ['ADM não é origem (cargo ADM)', ck.adm, 'ADM', adm, ex(mA), 400, 'cargo_invalido'],
    ['cargo MORADOR recusado', ck.adm, 'MORADOR', mA, ex(mB), 400, 'cargo_invalido'],
    ['cargo inventado recusado', ck.adm, 'DONO', mA, ex(mB), 400, 'cargo_invalido'],
    ['cargo em minúscula recusado', ck.adm, 'sindico', sind, ex(mA), 400, 'cargo_invalido'],
    ['origem errada: Morador não tem o cargo de Conselho', ck.adm, 'CONSELHO', mA, ex(mB), 409, 'origem_desatualizada'],
    ['origem errada: ADM não tem o cargo de Síndico', ck.adm, 'SINDICO', adm, ex(mA), 409, 'origem_desatualizada'],
    ['origem errada: Subsíndico não tem o cargo de Síndico', ck.adm, 'SINDICO', subs, ex(mA), 409, 'origem_desatualizada'],
    ['destino provisório recusado', ck.adm, 'CONSELHO', cons1, ex(prov), 409, 'destino_invalido'],
    ['destino = a própria origem recusado', ck.adm, 'CONSELHO', cons1, ex(cons1), 409, 'destino_invalido'],
    ['destino inexistente recusado', ck.adm, 'CONSELHO', cons1, ex(UUID_FALSO), 409, 'destino_invalido'],
    ['destino = Síndico atual (para Subsíndico) recusado', ck.adm, 'SUBSINDICO', subs, ex(sind), 409, 'destino_invalido'],
    ['Síndico NÃO se dá cargo (destino = executor)', ck.sind, 'SUBSINDICO', subs, ex(sind), 409, 'destino_invalido'],
    ['Síndico não transfere Síndico "de outra pessoa"', ck.sind, 'SINDICO', mA, ex(mB), 403, 'sem_permissao'],
    ['Síndico não transfere o Síndico usando o Subsíndico como origem', ck.sind, 'SINDICO', subs, ex(mB), 403, 'sem_permissao'],
    ['origem sem formato de id', ck.adm, 'CONSELHO', 'nao-e-uuid', ex(mA), 400, 'dados_invalidos'],
    ['destino sem id', ck.adm, 'CONSELHO', cons1, { tipo: 'EXISTENTE' }, 400, 'dados_invalidos'],
    ['tipo de destino desconhecido', ck.adm, 'CONSELHO', cons1, { tipo: 'ADM', id: mA }, 400, 'dados_invalidos'],
  ];
  for (const [nome, cookie, cargo, origem, destino, st, cod] of casos) {
    const r = await tr(cookie, cargo, origem, destino);
    ok(recusou(r, st, cod), `${nome} → ${r.status} ${r.data?.codigo}`);
  }
  const corpoVazio = await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie: ck.adm });
  ok(corpoVazio.status === 400, `corpo vazio → ${corpoVazio.status}`);
  ok((await retrato()) === antes, 'nenhuma recusa mudou perfil algum');
  ok((await admin.from('cargo_transferencias').select('id')).data.length === 0 && !(await admin.from('audit_logs').select('id').like('acao', 'Transferiu o cargo%')).data.length, 'recusas não deixam histórico nem transferência registrada');

  // ── 3) ADM transfere os quatro cargos para conta já cadastrada ──
  console.log('-- ADM transfere os quatro cargos (conta já cadastrada)');
  // Conselho sem unidade → provisório
  let r = await tr(ck.adm, 'CONSELHO', cons1, ex(mA));
  ok(r.status === 200 && r.data.success && r.data.origemProvisorio === true, `ADM: Conselho Conselho1 → Candidato A → ${r.status}`);
  let p = await papel(mA), o = await papel(cons1);
  ok(p.role === 'CONSELHO' && o.role === 'MORADOR' && o.cadastro_validado === false, 'destino virou Conselho; quem saiu (sem unidade) virou Morador PROVISÓRIO');
  const ckMA = await cookieDe(email('candidatoa'));
  ok((await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie: ckMA, body: { cargo: 'CONSELHO', origemId: mA, destino: ex(mB) } })).status === 403, 'o novo Conselho NÃO transfere cargo (só ADM e Síndico)');
  // repetir a MESMA chamada: idempotente (a origem não tem mais o cargo)
  r = await tr(ck.adm, 'CONSELHO', cons1, ex(mA));
  ok(recusou(r, 409, 'origem_desatualizada'), 'repetir a mesma transferência não troca de novo (origem desatualizada)');
  // Conselho com unidade → Morador validado
  r = await tr(ck.adm, 'CONSELHO', cons2, ex(mB));
  p = await papel(mB); o = await papel(cons2);
  ok(r.status === 200 && r.data.origemProvisorio === false && p.role === 'CONSELHO' && o.role === 'MORADOR' && o.cadastro_validado === true, 'Conselho com unidade ligada vira Morador VALIDADO (a unidade não muda)');
  ok((await admin.from('units').select('usuario_id').eq('id', unidadeSemMorador).single()).data.usuario_id === cons2, 'o vínculo da unidade continua o mesmo');
  // Portaria
  r = await tr(ck.adm, 'PORTARIA', port1, ex(mC));
  ok(r.status === 200 && (await papel(mC)).role === 'PORTARIA' && (await papel(port1)).role === 'MORADOR', 'ADM: Portaria → Candidato C');
  // Subsíndico
  await restaurar();
  r = await tr(ck.adm, 'SUBSINDICO', subs, ex(mA));
  ok(r.status === 200 && (await papel(mA)).role === 'SUBSINDICO' && (await papel(subs)).role === 'MORADOR' && (await contar('SUBSINDICO')) === 1, 'ADM: Subsíndico → Candidato A; continua exatamente um Subsíndico');
  // Síndico (existente, não é o Subsíndico)
  r = await tr(ck.adm, 'SINDICO', sind, ex(mB));
  ok(r.status === 200 && (await papel(mB)).role === 'SINDICO' && (await papel(sind)).role === 'MORADOR' && (await contar('SINDICO')) === 1, 'ADM: Síndico → Candidato B; continua exatamente um Síndico');
  // O Síndico antigo perde o poder na PRÓXIMA requisição, com a mesma sessão (sem novo login)
  const exSind = await tr(ck.sind, 'CONSELHO', cons1, ex(mC));
  ok(recusou(exSind, 403, 'sem_permissao'), 'ex-Síndico (mesma sessão) NÃO transfere mais: 403');
  const exc = await api('/api/usuarios/excluir', { method: 'POST', cookie: ck.sind, body: { userId: mC } });
  ok(exc.status === 403, `ex-Síndico NÃO exclui usuário (rota de equipe) → ${exc.status}`);
  ok(!(await cl.sind.from('pending_invites').select('id')).data?.length && !(await cl.sind.from('audit_logs').select('id').limit(1)).data?.length, 'ex-Síndico não lê fila de convites nem histórico (RLS)');
  const multaEx = await cl.sind.from('fines').insert({ numero_protocolo: 'QA-EX', bloco: 'Q', unidade: '101', unit_id: unidadeSemMorador, morador_nome: 'x', data_infracao: '2026-01-01', prazo_recurso_data: '2026-02-01', artigo_regimento: 'x', descricao_infracao: 'x', valor: 1, tipo: 'MULTA' });
  ok(/row-level security/.test(multaEx.error?.message ?? ''), `ex-Síndico não emite multa (RLS): ${multaEx.error?.message}`);
  const logS = (await cl.sind.from('profiles').select('role').eq('id', sind).single()).data;
  ok(logS.role === 'MORADOR', 'ex-Síndico lê o próprio perfil já como MORADOR (sem novo login)');
  // Troca Síndico <-> Subsíndico (o Síndico antigo vira Subsíndico)
  await restaurar();
  r = await tr(ck.adm, 'SUBSINDICO', subs, ex(mA)); // Subsíndico = Candidato A
  r = await tr(ck.adm, 'SINDICO', sind, ex(mA));
  ok(r.status === 200 && r.data.origemNovoPerfil === 'SUBSINDICO', 'Síndico → atual Subsíndico: resposta diz que o antigo vira SUBSINDICO');
  ok((await papel(mA)).role === 'SINDICO' && (await papel(sind)).role === 'SUBSINDICO' && (await contar('SINDICO')) === 1 && (await contar('SUBSINDICO')) === 1, 'troca: Candidato A é Síndico, o Síndico antigo é Subsíndico, sempre um de cada');
  // destino com cargo diferente: Subsíndico recebe Conselho (a vaga de Subsíndico fica livre)
  await restaurar();
  r = await tr(ck.adm, 'CONSELHO', cons1, ex(subs));
  ok(r.status === 200 && r.data.destinoPerfilAnterior === 'SUBSINDICO' && (await papel(subs)).role === 'CONSELHO' && (await contar('SUBSINDICO')) === 0, 'destino com outro cargo perde o antigo (perfil é um só): o Subsíndico virou Conselho e a vaga de Subsíndico ficou livre');
  r = await tr(ck.adm, 'SINDICO', sind, ex(cons2));
  ok(r.status === 200 && (await papel(cons2)).role === 'SINDICO' && (await papel(sind)).role === 'MORADOR', 'um Conselho pode virar Síndico (e deixa de ser Conselho)');

  // ── 4) Síndico transfere ──
  console.log('-- Síndico transfere');
  await restaurar();
  for (const [cargo, origem] of [['SUBSINDICO', subs], ['CONSELHO', cons1], ['PORTARIA', port1]]) {
    const rr = await tr(ck.sind, cargo, origem, ex(mA));
    ok(rr.status === 200 && (await papel(mA)).role === cargo && (await papel(origem)).role === 'MORADOR', `Síndico transfere ${cargo} → 200`);
    await restaurar();
  }
  r = await tr(ck.sind, 'SINDICO', sind, ex(mA));
  ok(r.status === 200 && (await papel(mA)).role === 'SINDICO' && (await papel(sind)).role === 'MORADOR', 'Síndico transfere o PRÓPRIO cargo → 200');
  ok(recusou(await tr(ck.sind, 'SUBSINDICO', subs, ex(mB)), 403, 'sem_permissao'), 'logo depois, o ex-Síndico já não transfere (mesma sessão)');
  await restaurar();

  // ── 5) Atomicidade: falha no meio desfaz tudo ──
  console.log('-- atomicidade e concorrência');
  const base = await retrato();
  for (const ponto of ['troca', 'historico']) {
    const rr = await admin.rpc('transferir_cargo', { p_executor: adm, p_cargo: 'SINDICO', p_origem: sind, p_destino: mA, p_simular_falha_apos: ponto });
    ok(!!rr.error, `falha forçada (${ponto}) levanta erro`);
    ok((await retrato()) === base, `falha forçada (${ponto}): NENHUM perfil mudou (rollback total)`);
    ok(!(await admin.from('cargo_transferencias').select('id')).data.length, `falha forçada (${ponto}): nenhuma transferência registrada`);
    ok(!(await admin.from('audit_logs').select('id').like('acao', 'Transferiu o cargo%')).data.length, `falha forçada (${ponto}): nenhum histórico gravado`);
    ok(!(await admin.from('notifications').select('id').in('usuario_id_alvo', [sind, mA])).data.length, `falha forçada (${ponto}): nenhum aviso gravado`);
  }
  ok((await contar('SINDICO')) === 1, 'depois das falhas forçadas continua exatamente um Síndico');

  // Duas transferências simultâneas do mesmo cargo: uma vence, a outra falha sem corromper.
  const par = await Promise.all([mA, mB, mC].map((d) => admin.rpc('transferir_cargo', { p_executor: adm, p_cargo: 'SINDICO', p_origem: sind, p_destino: d })));
  const oks = par.filter((x) => x.data?.ok).length;
  ok(oks === 1 && par.filter((x) => x.data?.codigo === 'origem_desatualizada').length === 2, `3 transferências simultâneas do Síndico: 1 vence, 2 recusadas (${par.map((x) => x.data?.ok ? 'ok' : x.data?.codigo ?? x.error?.message).join(', ')})`);
  ok((await contar('SINDICO')) === 1 && (await contar('SUBSINDICO')) === 1, 'após a disputa: exatamente um Síndico e um Subsíndico');
  ok((await admin.from('cargo_transferencias').select('id').eq('status', 'CONCLUIDA')).data.length === 1, 'só uma transferência ficou registrada');
  await restaurar();
  // Mistura: Síndico→Subsíndico (troca) ao mesmo tempo que Subsíndico→outra pessoa.
  const mix = await Promise.all([
    admin.rpc('transferir_cargo', { p_executor: adm, p_cargo: 'SINDICO', p_origem: sind, p_destino: subs }),
    admin.rpc('transferir_cargo', { p_executor: adm, p_cargo: 'SUBSINDICO', p_origem: subs, p_destino: mA }),
    admin.rpc('transferir_cargo', { p_executor: sind, p_cargo: 'SINDICO', p_origem: sind, p_destino: mB }),
  ]);
  ok(mix.every((x) => !x.error), 'disputas cruzadas não derrubam o banco (sem impasse nem erro)');
  ok((await contar('SINDICO')) === 1 && (await contar('SUBSINDICO')) <= 1, `disputas cruzadas: nunca 2 Síndicos nem 2 Subsíndicos (Síndicos ${await contar('SINDICO')}, Subsíndicos ${await contar('SUBSINDICO')})`);
  await restaurar();

  // ── 6) Auditoria e avisos ──
  console.log('-- histórico e avisos');
  r = await tr(ck.adm, 'CONSELHO', cons2, ex(mB));
  const { data: logs } = await admin.from('audit_logs').select('*').like('acao', 'Transferiu o cargo%');
  const log = logs?.[0];
  ok(logs?.length === 1 && log.usuario_id === adm && log.usuario_role === 'ADM' && log.modulo === 'SISTEMA', 'a troca grava UM registro no histórico (módulo SISTEMA), com quem executou');
  ok(log?.acao === 'Transferiu o cargo de Conselho de QA Conselho Dois para QA Candidato B', `frase do histórico: "${log?.acao}"`);
  const d = log?.detalhes ?? {};
  ok(d.cargo === 'CONSELHO' && d.origemCargoAnterior === 'CONSELHO' && d.origemCargoNovo === 'MORADOR' && d.destinoCargoAnterior === 'MORADOR' && d.destinoCargoNovo === 'CONSELHO' && d.tipoDestino === 'EXISTENTE' && d.resultado === 'CONCLUIDA' && d.origemId === cons2 && d.destinoId === mB, 'detalhes: cargo, cargos anterior/novo de cada lado, tipo, resultado e ids');
  ok(semDadosPessoais(log), 'histórico SEM e-mail nem telefone');
  ok(/Conselho de QA Conselho Dois para QA Candidato B/.test(descreverAuditoria(log.acao, log.detalhes).frase), 'a tela de Relatórios mostra a frase legível');
  const avisos = (await admin.from('notifications').select('*').in('usuario_id_alvo', [mB, cons2])).data;
  const paraDestino = avisos.find((n) => n.usuario_id_alvo === mB), paraOrigem = avisos.find((n) => n.usuario_id_alvo === cons2);
  ok(paraDestino?.titulo === 'Você agora é Conselho' && /passou o cargo de Conselho para você/.test(paraDestino.mensagem), 'aviso para o novo titular');
  ok(paraOrigem?.titulo === 'Você passou o cargo de Conselho' && /agora é de QA Candidato B\. Seu acesso é de Morador\./.test(paraOrigem.mensagem), 'aviso para quem saiu');
  const clB = await clientDe(email('candidatob')), clCons2 = await clientDe(email('conselho2'));
  ok((await clB.from('notifications').select('titulo').eq('usuario_id_alvo', mB)).data.length === 1, 'o novo titular vê o PRÓPRIO aviso');
  ok((await clCons2.from('notifications').select('titulo').eq('usuario_id_alvo', cons2)).data.length === 1, 'quem saiu vê o próprio aviso');
  ok(!(await clB.from('notifications').select('id').eq('usuario_id_alvo', cons2)).data.length, 'o novo titular NÃO vê o aviso de quem saiu');
  ok(!(await cl.adm.from('notifications').select('id').in('usuario_id_alvo', [mB, cons2])).data.length && !(await cl.sind.from('notifications').select('id').in('usuario_id_alvo', [mB, cons2])).data.length, 'nem ADM nem Síndico leem aviso endereçado a outra pessoa');
  ok(!!(await cl.adm.from('notifications').insert({ titulo: 'QA forjado', mensagem: 'x', tipo: 'GERAL', usuario_id_alvo: mA })).error, 'cliente (nem ADM) cria aviso para uma pessoa específica');
  // transferência concluída aparece para as partes e para a equipe; é só leitura
  ok((await cl.adm.from('cargo_transferencias').select('id')).data.length === 1 && (await clCons2.from('cargo_transferencias').select('id')).data.length === 1 && (await clB.from('cargo_transferencias').select('id')).data.length === 1, 'registro da transferência: equipe e as duas partes leem');
  ok(!(await cl.mA.from('cargo_transferencias').select('id')).data.length, 'morador de fora NÃO lê transferências');
  const trId = (await admin.from('cargo_transferencias').select('id').single()).data.id;
  for (const [nome, c] of [['ADM', cl.adm], ['Síndico', cl.sind], ['destino', clB]]) {
    const i = await c.from('cargo_transferencias').insert({ cargo: 'SINDICO', origem_nome: 'x', destino_nome: 'y', destino_tipo: 'NOVO', status: 'PENDENTE', executor_nome: 'z', executor_role: 'ADM' });
    await c.from('cargo_transferencias').update({ status: 'CANCELADA', destino_nome: 'adulterado' }).eq('id', trId);
    await c.from('cargo_transferencias').delete().eq('id', trId);
    ok(!!i.error, `${nome} NÃO grava em cargo_transferencias`);
  }
  ok((await admin.from('cargo_transferencias').select('status,destino_nome').eq('id', trId).single()).data.destino_nome === 'QA Candidato B', 'registro da transferência continua intacto');
  await restaurar();

  // ── 7) Trava de excluir o Síndico ──
  console.log('-- ninguém exclui o Síndico pelo app');
  ck.subs = await cookieDe(email('subsindico')); // sessões anteriores caem quando a conta muda de cargo (0042)
  ck.adm = await cookieDe(email('adm'));
  for (const [nome, cookie] of [['ADM', ck.adm], ['Subsíndico', ck.subs]]) {
    const e = await api('/api/usuarios/excluir', { method: 'POST', cookie, body: { userId: sind } });
    ok(e.status === 403 && /Síndico não pode ser excluído/.test(e.data?.error ?? ''), `${nome} NÃO exclui o Síndico → ${e.status} "${e.data?.error}"`);
  }
  ok((await papel(sind)).role === 'SINDICO' && !!(await admin.auth.admin.getUserById(sind)).data.user, 'o Síndico e a conta dele continuam lá');
  r = await tr(ck.adm, 'SINDICO', sind, ex(mA));
  const eRebaixado = await api('/api/usuarios/excluir', { method: 'POST', cookie: ck.adm, body: { userId: sind } });
  ok(eRebaixado.status === 200 && !(await admin.from('profiles').select('id').eq('id', sind)).data.length, 'depois de rebaixado, o ex-Síndico PODE ser excluído pela equipe');
  // refaz o elenco: a conta do Síndico foi apagada (a bateria recria a equipe no próximo uso)
  const novoSind = await criarUsuario(email('sindico'), { name: 'QA Síndico', role: 'MORADOR' });
  snap.splice(snap.findIndex((s) => s.id === sind), 1, { id: novoSind, role: 'SINDICO', cadastro_validado: true });
  todos.splice(todos.indexOf(sind), 1, novoSind);
  await restaurar();
  ck.sind = await cookieDe(email('sindico'));
  cl.sind = await clientDe(email('sindico'));
  const sind2 = novoSind;

  // ── 8) Destino novo: convite com cargo pendente ──
  console.log('-- destino novo: convite com cargo pendente');
  const novo = (n) => ({ tipo: 'NOVO', nome: `QA Novo ${n}`, email: email(`novo${n}`), telefone: '(11) 99999-0000' });
  const trans = async () => (await admin.from('cargo_transferencias').select('*').eq('status', 'PENDENTE')).data;
  for (const [nome, bad] of [['e-mail incompleto', { ...novo(0), email: 'nome@dominio' }], ['nome vazio', { ...novo(0), nome: '  ' }], ['e-mail sem arroba', { ...novo(0), email: 'nomedominio.com' }]]) {
    const rr = await tr(ck.adm, 'CONSELHO', cons1, bad);
    ok(recusou(rr, 400, 'dados_invalidos'), `convite com ${nome} recusado`);
  }
  const rc = await tr(ck.adm, 'CONSELHO', cons1, { tipo: 'NOVO', nome: 'QA Já Tem Conta', email: email('candidatoa') });
  ok(recusou(rc, 409, 'email_com_conta') && rc.data.contaNome === 'QA Candidato A' && /Use “Usuário já cadastrado” e escolha QA Candidato A/.test(rc.data.error), `e-mail que já tem conta: mensagem manda escolher a pessoa → "${rc.data.error}"`);
  await admin.from('pending_invites').insert({ nome: 'QA na fila', email: email('nafila'), role: 'PORTARIA', status: 'PENDENTE' });
  const rf = await tr(ck.adm, 'CONSELHO', cons1, { tipo: 'NOVO', nome: 'QA Na Fila', email: email('nafila') });
  ok(recusou(rf, 409, 'convite_existente'), 'e-mail com convite já na fila recusado');
  ok((await trans()).length === 0 && !(await admin.from('profiles').select('id').eq('email', email('nafila'))).data.length, 'recusas de convite não deixam transferência nem conta');
  const { data: { users: usersAntes } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  ok(!usersAntes.some((u) => u.email === email('nafila')) && !usersAntes.some((u) => u.email === email('novo0')), 'nem sobra conta no Auth depois das recusas');

  // Síndico → pessoa nova
  const sindAntes = await papel(sind2);
  r = await tr(ck.adm, 'SINDICO', sind2, novo(1));
  const link = r.data?.link ?? '';
  ok(r.status === 200 && r.data.success && r.data.tipo === 'NOVO' && new URL(link).pathname === '/definir-senha' && new URL(link).searchParams.has('token_hash'), 'ADM convida pessoa nova como Síndico: link seguro do app (token só é gasto no "Continuar")');
  const pend = (await trans())[0];
  ok(pend?.cargo === 'SINDICO' && pend.destino_tipo === 'NOVO' && pend.origem_id === sind2, 'transferência PENDENTE registrada');
  ok((await papel(sind2)).role === 'SINDICO' && (await contar('SINDICO')) === 1, 'ANTES do aceite o titular continua Síndico (e só há um)');
  const idNovo1 = pend.destino_id;
  const pNovo1 = await papel(idNovo1);
  ok(pNovo1.role === 'MORADOR' && pNovo1.cadastro_validado === false, 'a conta nova nasce SEM poder (Morador provisório)');
  ok(!!(await admin.from('profiles').select('telefone').eq('id', idNovo1).single()).data.telefone, 'telefone opcional fica no perfil');
  const inv = (await admin.from('pending_invites').select('*').eq('transferencia_id', pend.id).single()).data;
  const linkInv = (await admin.from('convite_links').select('link_acesso').eq('invite_id', inv.id).single()).data;
  ok(inv?.role === 'SINDICO' && inv.status === 'ENVIADO' && linkInv?.link_acesso === link, 'convite na fila: perfil Síndico (ao aceitar), com o link (guardado em convite_links)');
  const { data: logsP } = await admin.from('audit_logs').select('*').like('acao', 'Iniciou a transferência%');
  ok(logsP.length === 1 && /aguarda aceitar o convite/.test(logsP[0].acao) && semDadosPessoais(logsP[0]) && logsP[0].detalhes.resultado === 'PENDENTE', 'histórico da pendência, sem e-mail nem telefone');
  ok(/aguarda aceitar/.test(descreverAuditoria(logsP[0].acao, logsP[0].detalhes).frase), 'Relatórios descreve a pendência');
  // Uma pendência por cargo único
  const r2 = await tr(ck.adm, 'SINDICO', sind2, novo(2));
  ok(recusou(r2, 409, 'pendencia_existente') && /Já há uma transferência de Síndico aguardando QA Novo 1 aceitar/.test(r2.data.error), `segunda pendência de Síndico recusada → "${r2.data.error}"`);
  const r3 = await tr(ck.adm, 'SINDICO', sind2, ex(mA));
  ok(recusou(r3, 409, 'pendencia_existente'), 'transferir o Síndico para conta existente, com pendência aberta, também é recusado');
  ok((await trans()).length === 1 && !(await admin.from('profiles').select('id').eq('email', email('novo2'))).data.length && !(await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.some((u) => u.email === email('novo2')), 'a recusa não deixou conta órfã (nem no Auth)');
  // Conselho: uma pendência por pessoa que sai; outra pessoa pode sair em paralelo
  r = await tr(ck.adm, 'CONSELHO', cons1, novo(3));
  ok(r.status === 200, 'Conselho1 → pessoa nova (pendente) enquanto o Síndico tem pendência');
  ok(recusou(await tr(ck.adm, 'CONSELHO', cons1, novo(4)), 409, 'pendencia_existente'), 'segunda pendência para o MESMO conselheiro recusada');
  r = await tr(ck.adm, 'CONSELHO', cons2, novo(5));
  ok(r.status === 200 && (await trans()).length === 3, 'outro conselheiro pode ter a própria pendência');
  ok(recusou(await tr(ck.adm, 'CONSELHO', cons1, ex(mA)), 409, 'pendencia_existente'), 'conselheiro com pendência não é transferido a conta existente');
  // Convite pendente segura a vaga (isRoleTaken usa transferenciaId; aqui, o perfil na fila)
  // A conta pendente não pode receber outro cargo nem ser destino
  ok(recusou(await tr(ck.adm, 'PORTARIA', port1, ex(idNovo1)), 409, 'destino_invalido'), 'conta de destino pendente (provisória) não recebe outro cargo');
  // Antes do aceite, o destino novo não tem poder de equipe
  // Cancelar
  ck.subs = await cookieDe(email('subsindico'));
  ck.mA = await cookieDe(email('candidatoa'));
  for (const [nome, cookie] of [['Subsíndico', ck.subs], ['Morador', ck.mA]]) {
    const c = await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie, body: { transferenciaId: pend.id } });
    ok(c.status === 403, `${nome} NÃO cancela a pendência → ${c.status}`);
  }
  const cancel = await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie: ck.adm, body: { transferenciaId: pend.id } });
  ok(cancel.status === 200, 'ADM cancela a pendência do Síndico');
  ok((await papel(sind2)).role === 'SINDICO' && (await contar('SINDICO')) === 1, 'cancelar NÃO altera nenhum cargo');
  ok((await admin.from('cargo_transferencias').select('status').eq('id', pend.id).single()).data.status === 'CANCELADA' && !(await admin.from('pending_invites').select('id').eq('transferencia_id', pend.id)).data.length, 'transferência CANCELADA e convite saiu da fila');
  ok(!(await admin.from('profiles').select('id').eq('id', idNovo1)).data.length && !(await admin.auth.admin.getUserById(idNovo1)).data.user, 'conta provisória do convite apagada (perfil e Auth)');
  ok(recusou(await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie: ck.adm, body: { transferenciaId: pend.id } }), 409, 'nao_pendente'), 'cancelar de novo: recusado (já cancelada)');
  const vinculo = await anon().auth.verifyOtp({ token_hash: new URL(link).searchParams.get('token_hash'), type: 'invite' });
  ok(!!vinculo.error, 'o link do convite cancelado não vale mais');
  ok((await admin.from('audit_logs').select('id').like('acao', 'Cancelou a transferência%')).data.length === 1, 'cancelamento no histórico');
  // Síndico executor cancela a pendência do Conselho dele; o Síndico não cancela a do Síndico "dos outros"
  const pCons = (await trans()).find((t) => t.origem_id === cons1);
  const cancelS = await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie: ck.sind, body: { transferenciaId: pCons.id } });
  ok(cancelS.status === 200, 'Síndico cancela pendência de Conselho');

  // Aceite de verdade: link do convite → "Continuar" → senha → aceite
  r = await tr(ck.adm, 'SINDICO', sind2, novo(6));
  const linkAceite = new URL(r.data.link);
  for (let i = 0; i < 2; i++) await fetch(r.data.link, { headers: { 'user-agent': 'WhatsApp/2.23.20 A' } }); // robôs não gastam o link
  const pend6 = (await trans()).find((t) => t.destino_nome === 'QA Novo 6');
  const cN = anon();
  const v = await cN.auth.verifyOtp({ token_hash: linkAceite.searchParams.get('token_hash'), type: linkAceite.searchParams.get('type') });
  ok(!v.error, 'a pessoa nova abre o link (depois de 2 robôs) e toca em "Continuar"');
  ok((await papel(pend6.destino_id)).role === 'MORADOR' && (await papel(sind2)).role === 'SINDICO', 'só abrir o link e entrar NÃO dá o cargo');
  ok(!(await cN.from('pending_invites').select('id')).data?.length && !(await cN.from('fines').select('id')).data?.length, 'antes do aceite a conta nova não lê nada de equipe');
  ok(!(await cN.auth.updateUser({ password: SENHA })).error, 'define a senha');
  const ckN = await cookieDe(email('novo6'));
  const ac = await api('/api/usuarios/transferir-cargo/aceitar', { method: 'POST', cookie: ckN });
  ok(ac.status === 200 && ac.data.aplicada === true && ac.data.cargo === 'SINDICO', `aceite aplica o cargo → ${ac.status} ${JSON.stringify(ac.data)}`);
  ok((await papel(pend6.destino_id)).role === 'SINDICO' && (await papel(sind2)).role === 'MORADOR' && (await contar('SINDICO')) === 1, 'após o aceite: o novo é Síndico, o antigo vira Morador, só um Síndico');
  ok((await admin.from('cargo_transferencias').select('status').eq('id', pend6.id).single()).data.status === 'CONCLUIDA' && !(await admin.from('pending_invites').select('id').eq('transferencia_id', pend6.id)).data.length, 'transferência CONCLUIDA e convite saiu da fila');
  ok((await api('/api/usuarios/transferir-cargo/aceitar', { method: 'POST', cookie: await cookieDe(email('novo6')) })).data.aplicada === false, 'aceitar de novo não faz nada (aplicada: false)');
  const logA = (await admin.from('audit_logs').select('*').like('acao', 'Aceitou o convite e assumiu%')).data;
  ok(logA.length === 1 && logA[0].usuario_id === pend6.destino_id && logA[0].detalhes.executorId === adm && semDadosPessoais(logA[0]), 'histórico do aceite: quem aceitou, quem pediu em executorId, sem dados pessoais');
  const avN = (await admin.from('notifications').select('titulo').in('usuario_id_alvo', [pend6.destino_id, sind2])).data.map((n) => n.titulo).sort();
  ok(avN.join('|') === 'Você agora é Síndico|Você passou o cargo de Síndico', 'aceite avisa o novo titular e quem saiu');
  const clN = await clientDe(email('novo6'));
  ok((await clN.from('profiles').select('role').eq('id', pend6.destino_id).single()).data.role === 'SINDICO' && !(await cl.sind.from('profiles').select('id').neq('id', sind2)).data?.length, 'o novo Síndico passou a ler a equipe; o ex-Síndico (rebaixado) não lê mais');

  // Aceite que falha: a origem deixou de ser a titular enquanto o convite esperava
  await restaurar();
  r = await tr(ck.adm, 'PORTARIA', port1, novo(7));
  const p7 = (await trans())[0];
  await admin.from('profiles').update({ role: 'MORADOR' }).eq('id', port1);
  await admin.rpc('aceitar_transferencia_cargo', { p_usuario: UUID_FALSO });
  const ac7 = await admin.rpc('aceitar_transferencia_cargo', { p_usuario: p7.destino_id });
  ok(ac7.data?.ok === false && ac7.data.codigo === 'falhou', `aceite com a origem desatualizada FALHA → ${ac7.data?.motivo}`);
  ok((await papel(p7.destino_id)).role === 'MORADOR' && (await admin.from('cargo_transferencias').select('status,motivo_falha').eq('id', p7.id).single()).data.status === 'FALHOU', 'nada foi dado: a conta segue Morador e a transferência ficou FALHOU');
  ok((await admin.from('notifications').select('titulo').eq('usuario_id_alvo', adm)).data.some((n) => /não concluída/.test(n.titulo)), 'quem pediu foi avisado da falha');
  // E-mail do convite diferente do da conta
  await restaurar();
  r = await tr(ck.adm, 'CONSELHO', cons1, novo(8));
  const p8 = (await trans())[0];
  await admin.from('pending_invites').update({ email: email('outro-email') }).eq('transferencia_id', p8.id);
  const ac8 = await admin.rpc('aceitar_transferencia_cargo', { p_usuario: p8.destino_id });
  ok(ac8.data?.codigo === 'falhou' && /e-mail/.test(ac8.data.motivo) && (await papel(p8.destino_id)).role === 'MORADOR' && (await papel(cons1)).role === 'CONSELHO', 'aceite com e-mail diferente do convite: recusado, nada muda');

  // Excluir a conta de quem ia assumir cancela a pendência
  await restaurar();
  r = await tr(ck.adm, 'PORTARIA', port1, novo(9));
  const p9 = (await trans())[0];
  const e9 = await api('/api/usuarios/excluir', { method: 'POST', cookie: ck.adm, body: { userId: p9.destino_id } });
  ok(e9.status === 200 && (await admin.from('cargo_transferencias').select('status').eq('id', p9.id).single()).data.status === 'CANCELADA' && !(await admin.from('pending_invites').select('id').eq('transferencia_id', p9.id)).data.length, 'excluir o acesso da pessoa convidada cancela a pendência e tira o convite da fila');
  ok((await papel(port1)).role === 'PORTARIA', 'a titular segue titular');
  // Excluir a origem (Portaria1) com pendência cancela também
  r = await tr(ck.adm, 'PORTARIA', port1, novo(10));
  const p10 = (await trans())[0];
  const e10 = await api('/api/usuarios/excluir', { method: 'POST', cookie: ck.adm, body: { userId: port1 } });
  ok(e10.status === 200 && (await admin.from('cargo_transferencias').select('status').eq('id', p10.id).single()).data.status === 'CANCELADA', 'excluir a titular de uma pendência também cancela a pendência');
  await admin.auth.admin.deleteUser(p10.destino_id).catch(() => {});
  await admin.from('profiles').delete().eq('id', p10.destino_id);
  const novaPort = await criarUsuario(email('portaria'), { name: 'QA Portaria', role: 'PORTARIA' });
  snap.splice(snap.findIndex((s) => s.id === port1), 1, { id: novaPort, role: 'PORTARIA', cadastro_validado: true });
  todos.splice(todos.indexOf(port1), 1, novaPort);

  // A fila continua intacta para os convites comuns (não-transferência)
  ok((await admin.from('pending_invites').select('id').eq('email', email('nafila'))).data.length === 1, 'convite comum da fila não foi tocado');
  await restaurar();
}
