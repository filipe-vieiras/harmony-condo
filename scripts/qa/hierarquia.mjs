// Bateria da hierarquia entre perfis (issue #68) e do endurecimento do Zelador (revisão de 06/10/2026), migração 0042.
// Chamada por bateria.mjs depois de rodarZelador (que deixa o Zelador `zelador@qa...` ativo).
// Marcadores: [68] hierarquia; [zelador] endurecimento do perfil de Zelador (Z-01 a Z-09, L4).
import { admin, anon, api, cookieDe, clientDe, criarUsuario, ok, DOMINIO } from './lib.mjs';
import { podeAgirSobre, podeConvidarPara, NIVEL } from '../../src/lib/hierarquia.ts';
import { celulaCsv, linhaCsv } from '../../src/lib/csv.ts';
import { limparTextoLivre, textoVazio } from '../../src/lib/textoLivre.ts';

const email = (n) => `${n}@${DOMINIO}`;
const brHoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dia = (n) => new Date(Date.parse(brHoje() + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const CARGOS = ['ADM', 'SINDICO', 'SUBSINDICO', 'ZELADOR', 'CONSELHO', 'PORTARIA', 'MORADOR'];

export async function rodarHierarquia() {
  console.log('\n## H. Hierarquia entre perfis (#68) e endurecimento do Zelador (migração 0042)');

  // ── Contas ──
  const idDe = async (n) => (await admin.from('profiles').select('id').eq('email', email(n)).single()).data.id;
  const adm2 = await criarUsuario(email('adm2h'), { name: 'QA Administradora Dois', role: 'ADM' });
  const conselhoH = await criarUsuario(email('conselhoh'), { name: 'QA Conselho H', role: 'CONSELHO' });
  const portariaH = await criarUsuario(email('portariah'), { name: 'QA Portaria H', role: 'PORTARIA' });
  const moradorH = await criarUsuario(email('moradorh'), { name: 'QA Morador H', role: 'MORADOR' });
  const provH = await criarUsuario(email('provisorioh'), { name: 'QA Provisório H', role: 'MORADOR', cadastro_validado: false });
  // Zelador ativo desta rodada (a rodada do Zelador deixa `zelador` reativado; garante o estado).
  const { data: zAtivos } = await admin.from('profiles').select('id,email').eq('role', 'ZELADOR').is('desativado_em', null);
  if (!zAtivos?.some((z) => z.email === email('zelador'))) {
    await admin.from('profiles').update({ desativado_em: new Date().toISOString() }).eq('role', 'ZELADOR').is('desativado_em', null);
    await admin.from('profiles').update({ desativado_em: null }).eq('email', email('zelador'));
    await admin.auth.admin.updateUserById(await idDe('zelador'), { ban_duration: 'none' });
  }

  const EX = {
    ADM: 'adm', SINDICO: 'sindico', SUBSINDICO: 'subsindico', ZELADOR: 'zelador', CONSELHO: 'conselhoh', PORTARIA: 'portariah', MORADOR: 'moradorh',
  };
  const ids = { ADM: adm2, SINDICO: await idDe('sindico'), SUBSINDICO: await idDe('subsindico'), ZELADOR: await idDe('zelador'), CONSELHO: conselhoH, PORTARIA: portariaH, MORADOR: moradorH };
  const idAdm1 = await idDe('adm');
  const ck = {}; const cl = {};
  for (const [cargo, n] of Object.entries(EX)) { ck[cargo] = await cookieDe(email(n)); cl[cargo] = await clientDe(email(n)); }
  const ckProv = await cookieDe(email('provisorioh')); const cProv = await clientDe(email('provisorioh'));
  const cVis = anon();

  // ── Níveis e o espelho no banco ──
  ok(NIVEL.ADM === 4 && NIVEL.SINDICO === 4 && NIVEL.SUBSINDICO === 3 && NIVEL.ZELADOR === 2 && NIVEL.CONSELHO === 1 && NIVEL.PORTARIA === 1 && NIVEL.MORADOR === 0, '[68] níveis: ADM e Síndico 4, Subsíndico 3, Zelador 2, Conselho e Portaria 1, Morador 0');
  let difs = 0;
  for (const e of CARGOS) {
    for (const a of CARGOS) {
      for (const acao of ['RESETAR_SENHA', 'EXCLUIR']) {
        const db = (await admin.rpc('pode_agir_sobre', { p_executor: e, p_alvo: a, p_acao: acao, p_mesma_conta: false })).data;
        if (db !== podeAgirSobre(e, a, acao)) { difs++; console.log('  diferença', e, a, acao, db); }
      }
    }
    for (const c of CARGOS) {
      const db = (await admin.rpc('pode_convidar_cargo', { p_executor: e, p_cargo: c })).data;
      if (db !== podeConvidarPara(e, c)) { difs++; console.log('  diferença convite', e, c, db); }
    }
  }
  ok(difs === 0, '[68] a regra do TypeScript (src/lib/hierarquia.ts) e a do banco dão a mesma resposta em todas as combinações');
  ok(podeAgirSobre('ADM', 'SINDICO', 'RESETAR_SENHA') && !podeAgirSobre('SINDICO', 'ADM', 'RESETAR_SENHA') && !podeAgirSobre('ADM', 'SINDICO', 'EXCLUIR') && !podeAgirSobre('SINDICO', 'ADM', 'EXCLUIR') && !podeAgirSobre('ADM', 'ADM', 'RESETAR_SENHA') && !podeAgirSobre('SUBSINDICO', 'ZELADOR', 'RESETAR_SENHA') && !podeAgirSobre('SINDICO', 'SINDICO', 'RESETAR_SENHA', true), '[68] regra: ADM redefine a senha do Síndico; Síndico não age sobre ADM; ninguém exclui ADM nem Síndico; Subsíndico não age sobre Zelador; ninguém age sobre si');

  // ── Redefinir senha: matriz executor × alvo (rota) ──
  console.log('-- [68] redefinir senha: executor x alvo');
  const reset = (cookie, userId) => api('/api/usuarios/resetar-senha', { method: 'POST', cookie, body: { userId } });
  const contaAud = async () => (await admin.from('audit_logs').select('id', { count: 'exact', head: true }).like('acao', 'Gerou link de redefinição de senha%')).count;
  let matrizOk = true; const falhas = [];
  for (const exec of CARGOS) {
    for (const alvo of CARGOS) {
      if (alvo === 'ADM' && exec === 'ADM') continue; // ADM x ADM usa a conta adm2h (outra conta): coberto abaixo
      const antes = await contaAud();
      const r = await reset(ck[exec], ids[alvo]);
      const esperado = podeAgirSobre(exec, alvo, 'RESETAR_SENHA', false);
      const obteve = r.status === 200 && !!r.data?.link;
      if (obteve !== esperado || (!esperado && r.status !== 403) || (obteve && (await contaAud()) !== antes + 1) || (!obteve && (await contaAud()) !== antes)) { matrizOk = false; falhas.push(`${exec}->${alvo}: ${r.status}`); }
    }
  }
  ok(matrizOk, `[68] matriz de redefinição de senha (7 executores x 7 alvos): permitido só para nível estritamente menor (e ADM sobre Síndico), 403 nos demais, e só o permitido deixa auditoria ${falhas.join(' | ')}`);
  const adm2adm = await reset(ck.ADM, ids.ADM);
  ok(adm2adm.status === 403 && /nível igual ou superior/.test(adm2adm.data?.error ?? ''), `[68] ADM NÃO redefine a senha de outra ADM → ${adm2adm.status} "${adm2adm.data?.error}"`);
  ok((await reset(ck.ADM, idAdm1)).status === 403, '[68] ninguém redefine a própria senha por esta rota (use "Esqueci a senha")');
  ok((await reset(ckProv, ids.MORADOR)).status === 403 && (await reset(ckProv, ids.CONSELHO)).status === 403, '[68] Morador provisório NÃO redefine senha de ninguém');
  ok([401, 307].includes((await api('/api/usuarios/resetar-senha', { method: 'POST', body: { userId: ids.MORADOR } })).status), '[68] visitante é barrado na redefinição');
  const subSobSind = await reset(ck.SUBSINDICO, ids.SINDICO);
  ok(subSobSind.status === 403 && subSobSind.data?.codigo === 'sem_nivel' && !subSobSind.data?.link, `[68] Subsíndico NÃO gera link para o Síndico (nada devolvido) → "${subSobSind.data?.error}"`);

  // Auditoria no servidor e aviso ao titular.
  const logAdmSind = (await admin.from('audit_logs').select('*').like('acao', 'Gerou link de redefinição de senha para QA Síndico%').eq('usuario_role', 'ADM').order('created_at', { ascending: false }).limit(1)).data?.[0];
  ok(!!logAdmSind && logAdmSind.detalhes.alvoId === ids.SINDICO && logAdmSind.detalhes.acao === 'RESETAR_SENHA' && !/@|\(\d{2}\)/.test(JSON.stringify(logAdmSind)), '[68] a auditoria da redefinição (ADM sobre Síndico) é gravada pelo servidor, com quem e em quem, sem e-mail nem telefone');
  // A ADM nunca recebe: ninguém redefine a senha de ADM (nível igual); a regra do aviso cobre Síndico, ADM e Zelador.
  for (const alvo of ['SINDICO', 'ZELADOR']) {
    const av = (await admin.from('notifications').select('titulo,mensagem').eq('usuario_id_alvo', ids[alvo]).eq('titulo', 'Link de redefinição de senha gerado')).data ?? [];
    ok(av.length >= 1 && !/@/.test(av[0].mensagem), `[68] o titular ${alvo} recebe aviso (por usuário) quando geram um link de redefinição para ele`);
  }
  for (const alvo of ['CONSELHO', 'PORTARIA', 'MORADOR', 'SUBSINDICO']) {
    ok(!(await admin.from('notifications').select('id').eq('usuario_id_alvo', ids[alvo]).eq('titulo', 'Link de redefinição de senha gerado')).data?.length, `[68] ${alvo} não recebe esse aviso (só Síndico, ADM e Zelador)`);
  }
  ok((await cl.ZELADOR.from('notifications').select('titulo').eq('titulo', 'Link de redefinição de senha gerado')).data?.length >= 1 && !(await cl.SUBSINDICO.from('notifications').select('titulo').eq('titulo', 'Link de redefinição de senha gerado')).data?.length, '[68] o aviso aparece só para o titular (o sino do Zelador o lê, o do Subsíndico não)');

  // ── Excluir ──
  console.log('-- [68] excluir conta');
  const exc = (cookie, userId) => api('/api/usuarios/excluir', { method: 'POST', cookie, body: { userId } });
  const existe = async (id) => !!(await admin.from('profiles').select('id').eq('id', id).maybeSingle()).data;
  let exOk = true; const exFalhas = [];
  for (const exec of CARGOS) {
    for (const alvo of CARGOS) {
      if (alvo === 'ADM' && exec === 'ADM') continue;
      if (podeAgirSobre(exec, alvo, 'EXCLUIR')) continue; // permitidos são testados com contas descartáveis abaixo
      const r = await exc(ck[exec], ids[alvo]);
      // A mesma conta (Síndico excluindo o Síndico etc.) responde 400 "não exclua a própria conta"; os demais, 403.
      const esperadoStatus = exec === alvo && (exec === 'SINDICO' || exec === 'SUBSINDICO') ? 400 : 403;
      if (r.status !== esperadoStatus || !(await existe(ids[alvo]))) { exOk = false; exFalhas.push(`${exec}->${alvo}: ${r.status}`); }
    }
  }
  ok(exOk, `[68] matriz de exclusão: 403 e a conta continua lá em todo par proibido ${exFalhas.join(' | ')}`);
  const exSind = await exc(ck.ADM, ids.SINDICO);
  const exAdm = await exc(ck.SINDICO, idAdm1);
  const exAdm2 = await exc(ck.ADM, ids.ADM);
  ok(exSind.status === 403 && /transfira/.test(exSind.data?.error ?? '') && exAdm.status === 403 && /fora do aplicativo/.test(exAdm.data?.error ?? '') && exAdm2.status === 403 && (await existe(ids.SINDICO)) && (await existe(idAdm1)), `[68] nenhuma rota exclui o Síndico nem a ADM (nem o ADM sobre o Síndico): "${exSind.data?.error}" / "${exAdm.data?.error}"`);
  ok((await exc(ck.SINDICO, ids.SINDICO)).status === 400, '[68] ninguém exclui a própria conta');
  ok((await exc(ck.SUBSINDICO, ids.SUBSINDICO)).status === 400 || (await exc(ck.SUBSINDICO, ids.SUBSINDICO)).status === 403, '[68] Subsíndico não exclui a própria conta nem outro Subsíndico');
  // Permitidos, com contas descartáveis (e a auditoria no servidor).
  for (const [exec, alvoRole] of [['SINDICO', 'CONSELHO'], ['ADM', 'PORTARIA'], ['SUBSINDICO', 'MORADOR'], ['SUBSINDICO', 'CONSELHO'], ['ADM', 'MORADOR']]) {
    const idx = Math.floor(Math.random() * 1e6);
    const dId = await criarUsuario(email(`descart${idx}`), { name: `QA Descartável ${idx}`, role: alvoRole });
    const r = await exc(ck[exec], dId);
    const log = (await admin.from('audit_logs').select('*').eq('acao', `Excluiu o acesso de QA Descartável ${idx} (${alvoRole === 'CONSELHO' ? 'Conselho' : alvoRole === 'PORTARIA' ? 'Portaria' : 'Morador'})`)).data ?? [];
    ok(r.status === 200 && !(await existe(dId)) && log.length === 1 && log[0].usuario_role === exec && log[0].detalhes.alvoId === dId && !/@/.test(JSON.stringify(log[0])), `[68] ${exec} exclui ${alvoRole} (nível menor) e a auditoria é gravada pelo servidor`);
  }
  const dZ = await criarUsuario(email('descartz'), { name: 'QA Descartável Z', role: 'MORADOR' });
  ok((await exc(ck.CONSELHO, dZ)).status === 403 && (await exc(ck.PORTARIA, dZ)).status === 403 && (await exc(ck.ZELADOR, dZ)).status === 403 && (await exc(ckProv, dZ)).status === 403 && (await existe(dZ)), '[68] Conselho, Portaria, Zelador e provisório NÃO excluem nem Morador');
  ok([401, 307].includes((await api('/api/usuarios/excluir', { method: 'POST', body: { userId: dZ } })).status), '[68] visitante é barrado na exclusão');

  // ── Convites ──
  console.log('-- [68] convites: executor x cargo');
  // Por consulta direta ao banco (política da fila).
  let cvOk = true; const cvFalhas = [];
  for (const exec of ['ADM', 'SINDICO', 'SUBSINDICO', 'ZELADOR', 'CONSELHO', 'PORTARIA', 'MORADOR']) {
    for (const cargo of CARGOS) {
      const nome = `QA Conv ${exec} ${cargo}`;
      const r = await cl[exec].from('pending_invites').insert({ nome, email: email(`conv-${exec}-${cargo}`.toLowerCase()), role: cargo, status: 'PENDENTE' }).select();
      const entrou = !r.error && r.data?.length === 1;
      if (entrou !== podeConvidarPara(exec, cargo)) { cvOk = false; cvFalhas.push(`${exec}->${cargo}:${entrou}`); }
    }
  }
  ok(cvOk, `[68] fila de convites (consulta direta ao banco): só entra convite para cargo que o executor pode convidar ${cvFalhas.join(' | ')}`);
  ok(!(await cProv.from('pending_invites').insert({ nome: 'QA x', email: email('provconv'), role: 'MORADOR', status: 'PENDENTE' }).select()).data?.length && !!(await cVis.from('pending_invites').insert({ nome: 'QA x', email: email('visconv'), role: 'MORADOR', status: 'PENDENTE' })).error, '[68] provisório e visitante NÃO criam convite');
  // Subsíndico não promove um convite da fila para um cargo acima (UPDATE) nem apaga convite de cargo acima.
  const { data: inviteSub } = await admin.from('pending_invites').insert({ nome: 'QA Convite Sub Alvo', email: email('subalvo'), role: 'PORTARIA', status: 'PENDENTE' }).select().single();
  const upg = await cl.SUBSINDICO.from('pending_invites').update({ role: 'ADM' }).eq('id', inviteSub.id).select();
  ok((!!upg.error || !upg.data?.length) && (await admin.from('pending_invites').select('role').eq('id', inviteSub.id).single()).data.role === 'PORTARIA', '[68] Subsíndico NÃO promove um convite da fila para ADM (UPDATE direto)');
  const { data: inviteAdmCargo } = await admin.from('pending_invites').insert({ nome: 'QA Convite Zelador Fila', email: email('zfila'), role: 'ZELADOR', status: 'PENDENTE' }).select().single();
  ok(!(await cl.SUBSINDICO.from('pending_invites').delete().eq('id', inviteAdmCargo.id).select('id')).data?.length && (await admin.from('pending_invites').select('id').eq('id', inviteAdmCargo.id)).data.length === 1, '[68] Subsíndico NÃO apaga convite de Zelador da fila');
  await admin.from('pending_invites').delete().eq('id', inviteAdmCargo.id);
  // Auditoria do convite pelo banco.
  const logConv = (await admin.from('audit_logs').select('*').like('acao', 'Cadastrou convite de acesso para QA Conv SINDICO CONSELHO%')).data ?? [];
  ok(logConv.length === 1 && logConv[0].usuario_role === 'SINDICO' && !/@/.test(JSON.stringify(logConv[0])), '[68] a auditoria do convite é gravada pelo banco (gatilho), sem e-mail');
  // Pela rota de envio: o cargo é conferido de novo, nada é criado.
  const naFila = async (exec, cargo, n) => (await admin.from('pending_invites').insert({ nome: `QA Rota ${exec} ${cargo} ${n}`, email: email(`rota-${exec}-${cargo}-${n}`.toLowerCase()), role: cargo, status: 'PENDENTE' }).select().single()).data;
  for (const [exec, cargo] of [['SUBSINDICO', 'ADM'], ['SUBSINDICO', 'SINDICO'], ['SUBSINDICO', 'SUBSINDICO'], ['SUBSINDICO', 'ZELADOR'], ['SINDICO', 'ADM'], ['SINDICO', 'SINDICO'], ['ADM', 'ADM']]) {
    const inv = await naFila(exec, cargo, 1);
    const r = await api('/api/convites/enviar', { method: 'POST', cookie: ck[exec], body: { ids: [inv.id] } });
    const antes = (await admin.from('profiles').select('id').eq('email', inv.email)).data?.length;
    ok(r.status === 200 && r.data.results[0].ok === false && /Você não pode convidar|Só o Síndico e a Administradora/.test(r.data.results[0].mensagem ?? '') && !antes && (await admin.from('pending_invites').select('status').eq('id', inv.id).single()).data.status === 'PENDENTE', `[68] ${exec} NÃO envia convite de ${cargo} pela rota → "${r.data?.results?.[0]?.mensagem}"`);
    await admin.from('pending_invites').delete().eq('id', inv.id);
  }
  const invOkSub = await naFila('SUBSINDICO', 'PORTARIA', 2);
  const rOkSub = await api('/api/convites/enviar', { method: 'POST', cookie: ck.SUBSINDICO, body: { ids: [invOkSub.id] } });
  ok(rOkSub.status === 200 && rOkSub.data.results[0].ok === true, '[68] Subsíndico envia convite de Portaria (nível menor): permitido');
  ok(rOkSub.data.results[0].link === undefined && !JSON.stringify(rOkSub.data).includes('token_hash'), '[68] H-2 a resposta da rota NÃO devolve o link ao Subsíndico');
  const logEnv = (await admin.from('audit_logs').select('*').eq('acao', `Gerou o link de acesso de QA Rota SUBSINDICO PORTARIA 2 (PORTARIA)`)).data ?? [];
  ok(logEnv.length === 1 && logEnv[0].usuario_role === 'SUBSINDICO' && !/@/.test(JSON.stringify(logEnv[0])), '[68] o envio do link também é auditado pelo servidor');
  // H-2/H-3/H-4
  const invSind = await naFila('SINDICO', 'CONSELHO', 7);
  const rSind = await api('/api/convites/enviar', { method: 'POST', cookie: ck.SINDICO, body: { ids: [invSind.id] } });
  ok(rSind.data.results[0].ok === true && /token_hash/.test(rSind.data.results[0].link ?? ''), '[68] H-2 Síndico recebe o link na resposta (fluxo normal)');
  for (const [nome, c] of [['Síndico', cl.SINDICO], ['Subsíndico', cl.SUBSINDICO], ['ADM', cl.ADM]]) {
    const r = await c.from('pending_invites').insert({ nome: '   ', email: email(`nomevazio${nome}`.toLowerCase()), role: 'PORTARIA', status: 'PENDENTE' }).select();
    ok(!!r.error && !r.data?.length, `[68] H-3 ${nome} NÃO cadastra convite com nome só de espaços (banco)`);
  }
  const invSim = await naFila('SINDICO', 'PORTARIA', 8);
  const sim = await Promise.all([1, 2, 3].map(() => api('/api/convites/enviar', { method: 'POST', cookie: ck.SINDICO, body: { ids: [invSim.id] } })));
  // A perdedora vê o convite já em andamento: resultado com mensagem ou erro 409 claro (nunca lista vazia).
  const rs = sim.map((x) => x.data.results?.[0] ?? { ok: false, mensagem: x.data.error });
  ok(rs.filter((r) => r.ok).length === 1 && rs.filter((r) => !r.ok).every((r) => /já está (sendo enviado|em andamento)/.test(r.mensagem ?? '')) && (await admin.from('profiles').select('id').eq('email', invSim.email)).data.length === 1, `[68] H-4 três envios simultâneos do mesmo convite: um vence, os outros recebem mensagem clara (${rs.map((r) => r.ok ? 'ok' : r.mensagem).join(' / ')})`);

  // ── H-1: conta convidada com cargo pendente vale pelo nível do cargo de destino ──
  console.log('-- [68] H-1 conta convidada com cargo pendente');
  const conta = (n) => admin.from('profiles').select('id').eq('email', email(n)).single().then((x) => x.data?.id);
  const casosH1 = [
    ['SINDICO', ck.SINDICO, ids.SINDICO], ['SUBSINDICO', ck.SINDICO, ids.SUBSINDICO], ['CONSELHO', ck.ADM, ids.CONSELHO], ['PORTARIA', ck.ADM, ids.PORTARIA], ['ZELADOR', ck.ADM, ids.ZELADOR],
  ];
  for (const [cargoDest, ckExec, origem] of casosH1) {
    const mail = `h1-${cargoDest}`.toLowerCase();
    const tr = await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie: ckExec, body: { cargo: cargoDest, origemId: origem, destino: { tipo: 'NOVO', nome: `QA H1 ${cargoDest}`, email: email(mail), telefone: '' } } });
    if (tr.status !== 200) { ok(false, `[68] H-1 preparar transferência de ${cargoDest} (${tr.status} ${tr.data?.error})`); continue; }
    const idC = await conta(mail);
    const pp = await admin.from('profiles').select('role,desativado_em,cadastro_validado').eq('id', idC).single();
    // Os passos exatos do QA: o Subsíndico (e todo perfil abaixo de Síndico/ADM) tenta sequestrar a conta convidada.
    const r1 = await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ck.SUBSINDICO, body: { userId: idC } });
    const r2 = await api('/api/usuarios/excluir', { method: 'POST', cookie: ck.SUBSINDICO, body: { userId: idC } });
    ok(r1.status === 403 && !r1.data?.link && r1.data?.codigo === 'conta_pendente' && r2.status === 403 && !!(await admin.from('profiles').select('id').eq('id', idC).maybeSingle()).data, `[68] H-1 (${cargoDest}) Subsíndico NÃO redefine nem exclui a conta convidada (existe como ${pp.data?.role}) → ${r1.status}/${r2.status}`);
    let outrosOk = true;
    for (const exec of ['ZELADOR', 'CONSELHO', 'PORTARIA', 'MORADOR']) {
      const a = await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ck[exec], body: { userId: idC } });
      const b = await api('/api/usuarios/excluir', { method: 'POST', cookie: ck[exec], body: { userId: idC } });
      if (a.status !== 403 || b.status !== 403) outrosOk = false;
    }
    ok(outrosOk && (await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ckProv, body: { userId: idC } })).status === 403, `[68] H-1 (${cargoDest}) Zelador, Conselho, Portaria, Morador e provisório também recebem 403`);
    // Espelho no banco.
    const dbSub = (await admin.rpc('pode_agir_sobre_conta', { p_executor: 'SUBSINDICO', p_alvo: idC, p_acao: 'RESETAR_SENHA' })).data;
    const dbAdm = (await admin.rpc('pode_agir_sobre_conta', { p_executor: 'ADM', p_alvo: idC, p_acao: 'RESETAR_SENHA' })).data;
    const ef = (await admin.rpc('cargo_efetivo', { p_user: idC })).data;
    ok(ef === cargoDest && dbSub === false && dbAdm === (cargoDest !== 'ADM'), `[68] H-1 (${cargoDest}) banco: cargo efetivo = ${ef}, Subsíndico ${dbSub}, ADM ${dbAdm}`);
    // O Síndico/ADM que decidem a transferência continuam podendo agir (nunca sobre o próprio cargo de igual nível).
    const adm = await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ck.ADM, body: { userId: idC } });
    // A conta convidada do Zelador nasce desativada: a rota recusa gerar link (409), por qualquer perfil.
    ok(cargoDest === 'ZELADOR' ? adm.status === 409 : adm.status === 200 && !!adm.data?.link, `[68] H-1 (${cargoDest}) a ADM, que tem nível sobre o cargo, ainda redefine a senha da conta convidada`);
    const sind = await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ck.SINDICO, body: { userId: idC } });
    ok(cargoDest === 'SINDICO' ? sind.status === 403 : cargoDest === 'ZELADOR' ? sind.status === 409 : sind.status === 200, `[68] H-1 (${cargoDest}) o Síndico ${cargoDest === 'SINDICO' ? 'não age sobre quem vai ocupar o próprio nível' : 'redefine (nível maior)'} → ${sind.status}`);
    if (cargoDest === 'SINDICO') ok((await api('/api/usuarios/excluir', { method: 'POST', cookie: ck.ADM, body: { userId: idC } })).status === 403, '[68] H-1 ninguém exclui a conta convidada do Síndico (vale como Síndico)');
    // Cancela a transferência (a ADM decide) para o próximo caso.
    const t = (await admin.from('cargo_transferencias').select('id').eq('destino_id', idC).eq('status', 'PENDENTE').single()).data;
    await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie: ck.ADM, body: { transferenciaId: t.id } });
  }
  // Convite aberto (pending_invites) de cargo acima para uma conta que já existe vale pelo cargo do convite; e conta aguardando aceite.
  await admin.from('pending_invites').insert({ nome: 'QA Convite Aberto', email: email('moradorh'), role: 'SUBSINDICO', status: 'PENDENTE' });
  const rInv = await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ck.SUBSINDICO, body: { userId: moradorH } });
  ok(rInv.status === 403 && (await admin.rpc('cargo_efetivo', { p_user: moradorH })).data === 'SUBSINDICO', '[68] H-1 conta com convite aberto de Subsíndico vale como Subsíndico: o Subsíndico NÃO a redefine');
  await admin.from('pending_invites').delete().eq('email', email('moradorh'));
  const zAg = await criarUsuario(email('zaguardando'), { name: 'QA Zelador Aguardando', role: 'MORADOR' });
  await admin.from('profiles').update({ role: 'ZELADOR', desativado_em: new Date().toISOString(), aguardando_aceite: true }).eq('id', zAg);
  ok((await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ck.SUBSINDICO, body: { userId: zAg } })).status === 403 && (await api('/api/usuarios/excluir', { method: 'POST', cookie: ck.SUBSINDICO, body: { userId: zAg } })).status === 403, '[68] H-1 conta de Zelador aguardando aceite/desativada: o Subsíndico NÃO redefine nem exclui');
  ok(['ZELADOR'].includes((await admin.rpc('cargo_efetivo', { p_user: zAg })).data) && (await admin.rpc('pode_agir_sobre_conta', { p_executor: 'SUBSINDICO', p_alvo: zAg, p_acao: 'EXCLUIR' })).data === false, '[68] H-1 espelho no banco para conta de Zelador aguardando aceite');
  await admin.from('profiles').delete().eq('id', zAg); await admin.auth.admin.deleteUser(zAg);

  // Subsíndico convida MORADOR (vincular à unidade), Portaria e Conselho; nunca Zelador, Subsíndico, Síndico nem ADM.
  ok(['MORADOR', 'PORTARIA', 'CONSELHO'].every((c) => podeConvidarPara('SUBSINDICO', c)) && ['ZELADOR', 'SUBSINDICO', 'SINDICO', 'ADM'].every((c) => !podeConvidarPara('SUBSINDICO', c)), '[68] regra: o Subsíndico convida só Morador, Portaria e Conselho');
  const invMor = await naFila('SUBSINDICO', 'MORADOR', 9);
  const rMor = await api('/api/convites/enviar', { method: 'POST', cookie: ck.SUBSINDICO, body: { ids: [invMor.id] } });
  ok(rMor.status === 200 && rMor.data.results[0].ok === true && rMor.data.results[0].link === undefined, '[68] Subsíndico envia convite de Morador (vincular à unidade) pela rota, sem receber o link');
  ok(!(await cl.SUBSINDICO.from('pending_invites').insert({ nome: 'QA Sub Mor', email: email('submor'), role: 'MORADOR', status: 'PENDENTE' }).select()).error, '[68] Subsíndico coloca convite de Morador na fila (banco)');
  // R-2: segunda chamada do mesmo convite: erro claro, nunca lista vazia.
  const repetido = await api('/api/convites/enviar', { method: 'POST', cookie: ck.SINDICO, body: { ids: [invSim.id] } });
  ok(repetido.status === 409 && /já está em andamento/.test(repetido.data?.error ?? '') && repetido.data?.results === undefined, `[68] R-2 convite já enviado/em andamento: erro claro (${repetido.status} "${repetido.data?.error}"), sem results vazio`);
  // R-1: nome em branco com tab, NBSP, quebra de linha e caracteres invisíveis.
  const brancos = ['\t', '\u00A0', '\n', '\u200B', '\u202E ', ' \uFEFF ', '\u200F\u00A0\t'];
  let brOk = true;
  for (const [i, nm] of brancos.entries()) {
    const r = await cl.SINDICO.from('pending_invites').insert({ nome: nm, email: email(`branco${i}`), role: 'PORTARIA', status: 'PENDENTE' }).select();
    if (!r.error || r.data?.length || !textoVazio(nm)) brOk = false;
  }
  ok(brOk && !textoVazio('Ana') && !textoVazio('A\u00A0B') && textoVazio('   '), '[68] R-1 nome só com tab, NBSP, quebra de linha ou caracteres invisíveis/de direção é recusado (banco e regra da tela/rota); nome de verdade passa');
  // R-3: convite de TRANSFERÊNCIA só é mexido por Síndico e ADM.
  for (const [cargoT, origemT] of [['PORTARIA', ids.PORTARIA], ['CONSELHO', ids.CONSELHO]]) {
    const trr = await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie: ck.ADM, body: { cargo: cargoT, origemId: origemT, destino: { tipo: 'NOVO', nome: `QA R3 ${cargoT}`, email: email(`r3-${cargoT}`.toLowerCase()), telefone: '' } } });
    const invT = (await admin.from('pending_invites').select('id,nome').eq('email', email(`r3-${cargoT}`.toLowerCase())).single()).data;
    const del = await cl.SUBSINDICO.from('pending_invites').delete().eq('id', invT.id).select('id');
    const upd = await cl.SUBSINDICO.from('pending_invites').update({ nome: 'QA alterado' }).eq('id', invT.id).select();
    const aindaLa = (await admin.from('pending_invites').select('nome').eq('id', invT.id).single()).data;
    ok(trr.status === 200 && !del.data?.length && !upd.data?.length && aindaLa.nome === invT.nome, `[68] R-3 Subsíndico NÃO apaga nem altera o convite da transferência de ${cargoT} (REST)`);
    ok(!(await cl.SUBSINDICO.from('pending_invites').insert({ nome: 'QA fake', email: email(`r3f-${cargoT}`.toLowerCase()), role: cargoT, status: 'ENVIADO', transferencia_id: '00000000-0000-4000-8000-0000000000aa' }).select()).data?.length, `[68] R-3 ninguém fabrica convite de transferência pelo navegador (${cargoT})`);
    const tt = (await admin.from('cargo_transferencias').select('id').eq('cargo', cargoT).eq('status', 'PENDENTE').single()).data;
    await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie: ck.ADM, body: { transferenciaId: tt.id } });
  }

  // S-1: classe ampliada de "nome em branco" (controles e invisíveis de formato), no banco e na regra da tela/rota.
  const invisiveis = ['\u2060', '\u00AD', '\u0001', '\u007F', '\u0085', '\u009F', '\u200B', '\u2063', '\u061C', '\u180E', '\u3000', '\u{E0001}', '\u{E0041}', '\u{1D173}', '\u2060\u00AD\u200B \t'];
  let s1Ok = true; const s1Falhas = [];
  for (const [i, ch] of invisiveis.entries()) {
    const r = await cl.SINDICO.from('pending_invites').insert({ nome: ch, email: email(`s1-${i}`), role: 'PORTARIA', status: 'PENDENTE' }).select();
    if (!r.error || r.data?.length || !textoVazio(ch)) { s1Ok = false; s1Falhas.push(`U+${ch.codePointAt(0).toString(16)}`); }
  }
  ok(s1Ok, `[68] S-1 nome só com WORD JOINER, soft hyphen, controles e invisíveis de formato é recusado (banco e regra) ${s1Falhas.join(' ')}`);
  ok(!textoVazio('José') && !textoVazio('A\u00ADB') && !textoVazio('\u200BAna\u200B') && !(await cl.SINDICO.from('pending_invites').insert({ nome: 'José da Silva', email: email('s1-ok'), role: 'PORTARIA', status: 'PENDENTE' }).select()).error, '[68] S-1 nome de verdade (com acento, ou com invisível no meio) continua valendo');
  // S-2: transferência por pessoa nova com nome só de invisíveis: 400 claro, sem conta no Auth.
  const t400 = await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie: ck.ADM, body: { cargo: 'CONSELHO', origemId: ids.CONSELHO, destino: { tipo: 'NOVO', nome: '\u200B\u202E\u2066', email: email('s2-invisivel'), telefone: '' } } });
  const { data: { users: us2 } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  ok(t400.status === 400 && /nome|dados/i.test(t400.data?.error ?? '') && !us2.some((u) => u.email === email('s2-invisivel')), `[68] S-2 transferência com nome só de invisíveis → ${t400.status} "${t400.data?.error}", nenhuma conta criada`);
  // S-3: unidade com titular sem nome não grava (banco), com nome vazio ou só de invisíveis.
  const unitBase = { proprietario_nome: 'x', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'PROPRIETARIO', vagas_garagem: [], animais: '' };
  let s3Ok = true;
  for (const [i, nm] of ['', '   ', '\t', '\u00A0', '\u200B', '\u2060\u202E'].entries()) {
    const r = await cl.SINDICO.from('units').insert({ ...unitBase, bloco: 'R', numero: `95${i}`, moradores: [{ nome: nm, tipo: 'TITULAR', telefone: '', email: '' }] }).select();
    if (!r.error || !/morador_sem_nome/.test(r.error.message)) s3Ok = false;
  }
  ok(s3Ok, '[68] S-3 unidade com titular de nome vazio, tab, NBSP ou invisível NÃO grava (banco)');
  const uOk = await cl.SINDICO.from('units').insert({ ...unitBase, bloco: 'R', numero: '959', moradores: [{ nome: 'Maria Souza', tipo: 'TITULAR', telefone: '', email: '' }, { nome: 'João', tipo: 'DEPENDENTE', telefone: '' }] }).select().single();
  ok(!uOk.error, '[68] S-3 unidade com titular e dependente de verdade grava');
  const uUp = await cl.SINDICO.from('units').update({ moradores: [{ nome: '\u200B', tipo: 'TITULAR' }] }).eq('id', uOk.data.id).select();
  ok(!!uUp.error && /morador_sem_nome/.test(uUp.error.message), '[68] S-3 editar a unidade para titular sem nome também é recusado');
  await admin.from('units').delete().eq('id', uOk.data.id);

  // link_acesso fora do alcance do Subsíndico e do Zelador.
  const invLink = await naFila('SINDICO', 'CONSELHO', 3);
  await api('/api/convites/enviar', { method: 'POST', cookie: ck.SINDICO, body: { ids: [invLink.id] } });
  const linksAdm = (await cl.ADM.from('convite_links').select('invite_id,link_acesso').in('invite_id', [invLink.id, invOkSub.id])).data ?? [];
  ok(linksAdm.length === 2 && linksAdm.every((l) => /\/definir-senha\?token_hash=/.test(l.link_acesso)), '[68] ADM e Síndico leem o link do convite pendente (a tela da fila continua funcionando)');
  ok((await cl.SINDICO.from('convite_links').select('invite_id').in('invite_id', [invLink.id])).data?.length === 1, '[68] Síndico lê o link');
  for (const exec of ['SUBSINDICO', 'ZELADOR', 'CONSELHO', 'PORTARIA', 'MORADOR']) {
    ok(!(await cl[exec].from('convite_links').select('link_acesso')).data?.length, `[68] ${exec} NÃO lê link de convite`);
  }
  ok(!(await cProv.from('convite_links').select('link_acesso')).data?.length && !(await cVis.from('convite_links').select('link_acesso')).data?.length, '[68] provisório e visitante NÃO leem link de convite');
  ok(!!(await cl.SUBSINDICO.from('pending_invites').select('link_acesso')).error && !(await cl.SUBSINDICO.from('pending_invites').select('*').eq('id', invLink.id)).data?.[0]?.link_acesso, '[68] a coluna do link não existe mais na fila: o Subsíndico vê o convite, sem o link');
  ok(!!(await cl.SINDICO.from('convite_links').insert({ invite_id: invLink.id, link_acesso: 'x' })).error && !!(await cl.ADM.from('convite_links').update({ link_acesso: 'x' }).eq('invite_id', invLink.id)).error, '[68] ninguém grava link pelo navegador (só o servidor)');

  // ── Z-07: excluir a origem de uma transferência pendente apaga a conta convidada ──
  console.log('-- [zelador] Z-07 excluir com transferência pendente');
  const cons9 = await criarUsuario(email('conselho9'), { name: 'QA Conselho Nove', role: 'CONSELHO' });
  const t9 = await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie: ck.ADM, body: { cargo: 'CONSELHO', origemId: cons9, destino: { tipo: 'NOVO', nome: 'QA Convidado Nove', email: email('convidado9'), telefone: '' } } });
  ok(t9.status === 200 && !!(await admin.from('profiles').select('id').eq('email', email('convidado9'))).data?.length, '[zelador] Z-07 transferência pendente criada (conta convidada existe)');
  const exc9 = await exc(ck.SINDICO, cons9);
  const { data: { users: us9 } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  ok(exc9.status === 200 && !(await admin.from('profiles').select('id').eq('email', email('convidado9'))).data?.length && !us9.some((u) => u.email === email('convidado9')) && !us9.some((u) => u.email === email('conselho9')), '[zelador] Z-07 excluir a origem apaga também a conta convidada (perfil e Auth) e libera o e-mail');
  ok((await admin.from('cargo_transferencias').select('status').eq('origem_nome', 'QA Conselho Nove')).data?.every((t) => t.status === 'CANCELADA') && !(await admin.from('pending_invites').select('id').eq('email', email('convidado9'))).data?.length, '[zelador] Z-07 a transferência fica cancelada e o convite some');

  // ── Z-01: parecer da reserva íntegro e auditado pelo banco ──
  console.log('-- [zelador] Z-01 a Z-09');
  const base = { descricao: 'QA', capacidade_max: 20, horario_funcionamento: '10h-22h', taxa_limpeza: 0, regras: [] };
  const { data: espH } = await admin.from('spaces').insert({ ...base, nome: 'QA H Salão', exige_aprovacao: true }).select().single();
  const mH1 = await criarUsuario(email('moradorh1'), { name: 'QA moradorh1', role: 'MORADOR', bloco: 'Q', unidade: '103' });
  const unit103 = (await admin.from('units').select('id').eq('bloco', 'Q').eq('numero', '103').single()).data;
  await admin.from('units').update({ usuario_id: mH1, status_convite: 'ATIVO' }).eq('id', unit103.id);
  const cMH = await clientDe(email('moradorh1'));
  const rv = (c, d, bloco = 'Q', un = '103') => c.from('reservations').insert({ espaco_id: espH.id, espaco_nome: espH.nome, bloco, unidade: un, morador_nome: 'QA moradorh1', data: d, horario_inicio: '12:00', horario_fim: '16:00', convidados_estimados: 5, status: 'PENDENTE' }).select().single();
  const r1 = await rv(cMH, dia(100)), r2 = await rv(cMH, dia(101)), r3 = await rv(cMH, dia(102)), r4 = await rv(cMH, dia(103));
  const aprZ = await cl.ZELADOR.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA Administradora (ADM)', data_avaliacao: '2000-01-01T00:00:00Z' }).eq('id', r1.data.id).select().single();
  ok(aprZ.data?.avaliado_por === 'QA Zelador (Zelador)' && Math.abs(Date.now() - Date.parse(aprZ.data.data_avaliacao)) < 120000, `[zelador] Z-01 quem decidiu e quando vêm do banco (avaliado_por="${aprZ.data?.avaliado_por}"), nunca do que o navegador mandou`);
  const logApr = (await admin.from('audit_logs').select('*').eq('acao', 'Aprovou reserva de QA H Salão')).data;
  ok(logApr.length === 1 && logApr[0].usuario_role === 'ZELADOR' && logApr[0].detalhes.reservationId === r1.data.id && logApr[0].detalhes.aprovado === true, '[zelador] Z-01 a decisão por API deixa UMA linha de auditoria (gravada no gatilho, sem duplicar com o navegador)');
  const av1 = (await cMH.from('notifications').select('titulo,mensagem').eq('titulo', 'Reserva Aprovada!').like('mensagem', '%QA H Salão%')).data;
  ok(av1.length === 1, '[zelador] Z-01 a decisão por API avisa o morador (aviso gerado pelo banco)');
  const m300 = 'm'.repeat(300), m301 = 'm'.repeat(301);
  const rec301 = await cl.ZELADOR.from('reservations').update({ status: 'RECUSADA', motivo_recusa: m301 }).eq('id', r2.data.id).select();
  ok(!!rec301.error && /motivo_muito_longo/.test(rec301.error.message), '[zelador] Z-01 motivo acima de 300 caracteres é recusado');
  const rec300 = await cl.ZELADOR.from('reservations').update({ status: 'RECUSADA', motivo_recusa: 'a​b‮c' + m300.slice(0, 290) }).eq('id', r2.data.id).select().single();
  ok(rec300.data?.status === 'RECUSADA' && rec300.data.motivo_recusa.startsWith('abc') && rec300.data.avaliado_por === 'QA Zelador (Zelador)', '[zelador] Z-01/Z-05 motivo de até 300 é aceito, sem caracteres invisíveis e com o parecer do banco');
  // Qualquer perfil que decide por API também deixa auditoria e aviso (uma só linha).
  const aprS = await cl.SINDICO.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA Síndico (SINDICO)' }).eq('id', r3.data.id).select().single();
  ok(aprS.data?.status === 'APROVADA' && (await admin.from('audit_logs').select('id').eq('acao', 'Aprovou reserva de QA H Salão')).data.length === 2, '[zelador] Z-01 o Síndico decidindo por API também deixa auditoria (uma linha)');
  const alt = await admin.from('reservations').select('avaliado_por').eq('id', r3.data.id).single();
  ok(alt.data.avaliado_por === 'QA Síndico (SINDICO)', '[zelador] o parecer da gestão segue como o navegador manda (só o do Zelador é imposto)');
  // Z-08: reserva encerrada não é reaberta.
  const cancS = await cl.SINDICO.from('reservations').update({ status: 'CANCELADA', motivo_recusa: 'QA cancelada' }).eq('id', r3.data.id).select().single();
  ok(cancS.data?.status === 'CANCELADA', '[zelador] Z-08 a gestão cancela reserva aprovada');
  for (const [nome, c, id] of [['Zelador', cl.ZELADOR, r3.data.id], ['Síndico', cl.SINDICO, r3.data.id], ['ADM', cl.ADM, r3.data.id], ['Subsíndico', cl.SUBSINDICO, r2.data.id]]) {
    for (const novo of ['APROVADA', 'PENDENTE']) {
      const r = await c.from('reservations').update({ status: novo }).eq('id', id).select();
      ok(!!r.error && /reserva_encerrada/.test(r.error.message), `[zelador] Z-08 ${nome} NÃO reabre reserva cancelada/recusada (${novo}) → ${r.error?.message}`);
    }
  }
  ok((await admin.from('reservations').select('status').eq('id', r3.data.id).single()).data.status === 'CANCELADA', '[zelador] Z-08 a reserva continua cancelada');
  // Quem não decide continua sem decidir.
  for (const [nome, c] of [['Portaria', cl.PORTARIA], ['Conselho', cl.CONSELHO], ['Morador', cMH]]) {
    ok(!(await c.from('reservations').update({ status: 'APROVADA' }).eq('id', r4.data.id).select()).data?.length, `[zelador] ${nome} NÃO decide reserva`);
  }
  ok((await admin.from('audit_logs').select('id').eq('acao', 'Aprovou reserva de QA H Salão')).data.length === 2, '[zelador] decisão negada não deixa auditoria');

  // ── Z-05 e Z-09 ──
  const { data: espI } = await admin.from('spaces').insert({ ...base, nome: 'QA H Interdição' }).select().single();
  const iv = await cl.ZELADOR.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false, p_motivo: 'Obra‮ sem​ texto﻿ oculto⁦' });
  ok(!iv.error && (await admin.from('spaces').select('motivo_interdicao').eq('id', espI.id).single()).data.motivo_interdicao === 'Obra sem texto oculto', '[zelador] Z-05 o motivo da interdição sai sem caracteres de direção nem largura zero');
  ok(limparTextoLivre('a​b‏c‪d‮e⁦f⁩g﻿h') === 'abcdefgh' && limparTextoLivre('a‐b') === 'a‐b', '[zelador] Z-05 a limpeza da tela remove só os caracteres invisíveis e de direção (o hífen e o acento ficam)');
  const inex = await cl.ZELADOR.rpc('interditar_espaco', { p_espaco_id: 'nao-existe-qa', p_ativo: false });
  ok(inex.error?.code === '22023' && /espaco_nao_encontrado/.test(inex.error.message), `[zelador] Z-09 espaço inexistente responde erro claro (${inex.error?.code}), não 500`);

  // ── Z-03: CSV sem fórmula ──
  console.log('-- [zelador] Z-03 CSV');
  const casos = [['=1+1', `"'=1+1"`], ['+SOMA(A1)', `"'+SOMA(A1)"`], ['-2+3', `"'-2+3"`], ['@cmd', `"'@cmd"`], ['\tx', `"'\tx"`], ['\rx', `"'\rx"`], ['normal', '"normal"'], ['diz "oi"', '"diz ""oi"""'], ['=HYPERLINK("http://x")', `"'=HYPERLINK(""http://x"")"`], [12, '"12"'], [null, '""']];
  ok(casos.every(([v, esp]) => celulaCsv(v) === esp), '[zelador] Z-03 células que começam com =, +, -, @, tab ou CR ganham apóstrofo; aspas são duplicadas');
  ok(linhaCsv(['=cmd', 'ok']) === `"'=cmd";"ok"`, '[zelador] Z-03 a linha do CSV usa o mesmo tratamento');
  // Mesmo texto livre gravado por qualquer perfil na auditoria chega neutralizado ao arquivo.
  ok(celulaCsv('=IMPORTXML("x")').startsWith(`"'=`), '[zelador] Z-03 ação da auditoria começando em "=" sai como texto');

  // ── M-3: convite duplicado para e-mail de conta que já existe ──
  console.log('-- [68] M-3 e M-2 e B-1 (revisão final)');
  const trM3 = await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie: ck.ADM, body: { cargo: 'PORTARIA', origemId: ids.PORTARIA, destino: { tipo: 'NOVO', nome: 'QA M3 Convidado', email: email('m3-convidado'), telefone: '' } } });
  const linkOriginal = new URL(trM3.data.link);
  const idM3 = await admin.from('profiles').select('id').eq('email', email('m3-convidado')).single().then((x) => x.data.id);
  const dup = await cl.SUBSINDICO.from('pending_invites').insert({ nome: 'QA Duplicado', email: email('m3-convidado').toUpperCase(), role: 'PORTARIA', status: 'PENDENTE' }).select();
  ok(!!dup.error && dup.error.code === '23505', `[68] M-3 índice único: segundo convite para o mesmo e-mail (mesmo em maiúsculas) é recusado (${dup.error?.code})`);
  // Mesmo furando a fila (inserido pelo servidor com outro e-mail e depois trocado de caixa), a rota recusa antes de gerar link.
  const invDupe = (await admin.from('pending_invites').insert({ nome: 'QA Duplicado Rota', email: email('m3-duplicado-rota'), role: 'PORTARIA', status: 'PENDENTE' }).select().single()).data;
  await admin.from('profiles').update({ email: email('m3-duplicado-rota') }).eq('id', moradorH);
  const rDup = await api('/api/convites/enviar', { method: 'POST', cookie: ck.SUBSINDICO, body: { ids: [invDupe.id] } });
  await admin.from('profiles').update({ email: email('moradorh') }).eq('id', moradorH);
  ok(rDup.data.results[0].ok === false && /Já existe uma conta com este e-mail/.test(rDup.data.results[0].mensagem ?? ''), `[68] M-3 a rota recusa convite para e-mail de conta que já existe, em português: "${rDup.data.results[0]?.mensagem}"`);
  const vOriginal = await anon().auth.verifyOtp({ token_hash: linkOriginal.searchParams.get('token_hash'), type: linkOriginal.searchParams.get('type') });
  ok(!vOriginal.error, '[68] M-3 o link original da transferência continua válido depois da tentativa');
  const t3 = (await admin.from('cargo_transferencias').select('id').eq('destino_id', idM3).eq('status', 'PENDENTE').single()).data;

  // ── M-2: conta com cargo pendente não é ligada a unidade nem apagada pela exclusão de unidade ──
  const uM2 = (await admin.from('units').insert({ bloco: 'R', numero: '970', proprietario_nome: 'x', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'DESOCUPADO', moradores: [], vagas_garagem: [], animais: '' }).select().single()).data;
  const lig = await cl.SUBSINDICO.from('units').update({ usuario_id: idM3 }).eq('id', uM2.id).select();
  ok((!!lig.error && /conta_com_cargo_pendente/.test(lig.error.message)) && !(await admin.from('units').select('usuario_id').eq('id', uM2.id).single()).data.usuario_id, '[68] M-2 o Subsíndico NÃO aponta a unidade para a conta convidada de uma transferência (gatilho)');
  const exU = await api('/api/unidades/excluir', { method: 'POST', cookie: ck.SUBSINDICO, body: { unitId: uM2.id } });
  ok(exU.status === 200 && !!(await admin.from('profiles').select('id').eq('id', idM3).maybeSingle()).data && !!(await admin.from('cargo_transferencias').select('id').eq('id', t3.id).eq('status', 'PENDENTE').maybeSingle()).data, '[68] M-2 excluir a unidade não apaga a conta convidada nem mexe na transferência pendente');
  // Nem por service role (o gatilho vale para todos).
  const uM2b = (await admin.from('units').insert({ bloco: 'R', numero: '971', proprietario_nome: 'x', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'DESOCUPADO', moradores: [], vagas_garagem: [], animais: '' }).select().single()).data;
  ok(!!(await admin.from('units').update({ usuario_id: idM3 }).eq('id', uM2b.id)).error, '[68] M-2 o gatilho recusa a ligação também para o servidor');
  await admin.from('units').delete().eq('id', uM2b.id);
  await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie: ck.ADM, body: { transferenciaId: t3.id } });

  // ── B-1 ──
  let b1 = true;
  for (const [i, ch] of ['\u2800', '\u3164', '\u034F', '\u115F\u1160', '\uFFA0', '\u17B4', '\u180B'].entries()) {
    const r = await cl.SINDICO.from('pending_invites').insert({ nome: ch, email: email(`b1-${i}`), role: 'PORTARIA', status: 'PENDENTE' }).select();
    if (!r.error || !textoVazio(ch)) b1 = false;
  }
  ok(b1, '[68] B-1 nome só de U+2800, U+3164, U+034F, fillers de Hangul, U+FFA0 ou U+17B4/180B é recusado (banco e regra da tela)');
  const baseU = { proprietario_nome: 'x', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'PROPRIETARIO', vagas_garagem: [], animais: '' };
  const naoLista = await cl.SINDICO.from('units').insert({ ...baseU, bloco: 'R', numero: '972', moradores: { nome: 'x' } }).select();
  const semNome = await cl.SINDICO.from('units').insert({ ...baseU, bloco: 'R', numero: '973', moradores: [{ tipo: 'TITULAR' }] }).select();
  const nomeNum = await cl.SINDICO.from('units').insert({ ...baseU, bloco: 'R', numero: '974', moradores: [{ nome: 123, tipo: 'TITULAR' }] }).select();
  const braille = await cl.SINDICO.from('units').insert({ ...baseU, bloco: 'R', numero: '975', moradores: [{ nome: '\u2800\u3164', tipo: 'TITULAR' }] }).select();
  ok(!!naoLista.error && /moradores_invalido/.test(naoLista.error.message) && !!semNome.error && !!nomeNum.error && !!braille.error, '[68] B-1 `moradores` que não é lista, morador sem nome, nome numérico e nome só de braille em branco/Hangul filler são recusados na unidade');
  // Dado antigo: morador que já estava na unidade e não mudou não trava a edição do resto.
  const velho = (await admin.from('units').insert({ ...baseU, bloco: 'R', numero: '976', moradores: [{ nome: 'Antigo Valido', tipo: 'TITULAR' }] }).select().single()).data;
  const edVelho = await cl.SINDICO.from('units').update({ moradores: [{ ...velho.moradores[0] }, { nome: 'Novo Dependente', tipo: 'DEPENDENTE' }] }).eq('id', velho.id).select();
  ok(!edVelho.error, '[68] B-1 acrescentar um dependente de verdade a uma unidade existente continua funcionando');
  await admin.from('units').delete().eq('id', velho.id);

  // ── M-1: link de redefinição gerado antes da promoção não vale depois ──
  console.log('-- [68] M-1 link antigo morre na promoção');
  const antes = await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ck.SUBSINDICO, body: { userId: ids.CONSELHO } });
  ok(antes.status === 200 && !!antes.data?.link, '[68] M-1 (preparo) o Subsíndico gera link para a conta de Conselho (nível menor: permitido)');
  const lk = new URL(antes.data.link);
  const promo = await api('/api/usuarios/transferir-cargo', { method: 'POST', cookie: ck.ADM, body: { cargo: 'SINDICO', origemId: ids.SINDICO, destino: { tipo: 'EXISTENTE', id: ids.CONSELHO } } });
  const usa = await anon().auth.verifyOtp({ token_hash: lk.searchParams.get('token_hash'), type: lk.searchParams.get('type') });
  ok(promo.status === 200 && !!usa.error, `[68] M-1 depois que a ADM passa o Síndico para essa conta, o link antigo NÃO vale (${promo.status}; ${usa.error?.message ?? 'sem erro!'})`);
  const refresh = await cl.CONSELHO.auth.refreshSession();
  ok(!!refresh.error, '[68] M-1 as sessões abertas da conta promovida também caem');
  // Restaura os papéis para o fim da bateria.
  await admin.from('profiles').update({ role: 'MORADOR' }).in('id', [ids.CONSELHO, ids.SINDICO]);
  await admin.from('profiles').update({ role: 'CONSELHO' }).eq('id', ids.CONSELHO);
  await admin.from('profiles').update({ role: 'SINDICO' }).eq('id', ids.SINDICO);

  // ── Limpeza do que esta rodada deixou fora do padrão ──
  await admin.from('notifications').delete().eq('titulo', 'Link de redefinição de senha gerado');
  await admin.from('notifications').delete().like('mensagem', '%QA H %');
  await admin.from('pending_invites').delete().like('email', `%@${DOMINIO}`);
  void ids; void provH; void portariaH;
}
