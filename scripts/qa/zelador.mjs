// Bateria do perfil de Zelador (issue #82, PRD docs/specs/2026-10-05-perfil-zelador.md, migração 0041).
// Chamada por bateria.mjs, que já criou a equipe de QA (Síndico, Subsíndico, ADM, Portaria, Conselho), as unidades
// Q-101..104 e os moradores validados morador1 (Q-101) e morador2 (Q-102).
// Todo teste desta fase começa com [zelador]. Cobre: convite sem unidade e hierarquia, trava de unidade, o que o Zelador
// consegue, a escalada que NÃO consegue (banco e API), interdição (só ativo e motivo, reservas intactas, novo pedido
// recusado para todos, reativar), motivo, saída do cargo (conta desativada, ban, histórico) e reativação.
import { admin, anon, api, cookieDe, clientDe, criarUsuario, ok, DOMINIO, SENHA } from './lib.mjs';
import { avaliarVinculo } from '../../src/lib/vinculoUnidade.ts';
import { isOperacao, isZelador, rotaPermitida, ROTAS_DO_ZELADOR } from '../../src/lib/roles.ts';
import { reservasFuturasDoEspaco, textoEmManutencao, normalizarMotivo } from '../../src/lib/interdicao.ts';

const email = (n) => `${n}@${DOMINIO}`;
const T = '[zelador]';
const brHoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dia = (n) => new Date(Date.parse(brHoje() + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export async function rodarZelador({ U }) {
  console.log('\n## Z. Perfil de Zelador (issue #82, migração 0041)');

  // Limpa o que uma execução anterior possa ter deixado (sem tocar no restante da base).
  const limpa = async () => {
    await admin.from('pending_invites').delete().eq('role', 'ZELADOR');
    await admin.from('cargo_transferencias').delete().eq('cargo', 'ZELADOR');
    await admin.from('profiles').update({ desativado_em: null }).eq('role', 'ZELADOR');
  };
  await limpa();
  // O seed traz um Zelador de teste (zelador@staging.test): sai da frente, a bateria cria o dela pelo convite real.
  const { data: zSeed } = await admin.from('profiles').select('id,email').eq('role', 'ZELADOR');
  const zSeedGuardado = [];
  for (const z of zSeed ?? []) {
    if (!z.email?.endsWith(`@${DOMINIO}`)) {
      zSeedGuardado.push(z);
      await admin.from('profiles').update({ desativado_em: new Date().toISOString() }).eq('id', z.id);
    }
  }

  // Moradores próprios desta fase (os da bateria principal já foram reaproveitados/alterados por seções anteriores).
  const mz1 = await criarUsuario(email('moradorz1'), { name: 'QA moradorz1', role: 'MORADOR', bloco: 'Q', unidade: '101' });
  const mz2 = await criarUsuario(email('moradorz2'), { name: 'QA moradorz2', role: 'MORADOR', bloco: 'Q', unidade: '102' });
  await admin.from('units').update({ usuario_id: mz1, status_convite: 'ATIVO' }).eq('id', U['101']);
  await admin.from('units').update({ usuario_id: mz2, status_convite: 'ATIVO' }).eq('id', U['102']);

  const ckAdm = await cookieDe(email('adm')), ckSind = await cookieDe(email('sindico')), ckSub = await cookieDe(email('subsindico'));
  const ckPort = await cookieDe(email('portaria')), ckCons = await cookieDe(email('conselho')), ckM1 = await cookieDe(email('moradorz1'));
  const cAdm = await clientDe(email('adm')), cSind = await clientDe(email('sindico')), cSub = await clientDe(email('subsindico'));
  const cPort = await clientDe(email('portaria')), cCons = await clientDe(email('conselho'));
  const cM1 = await clientDe(email('moradorz1')), cM2 = await clientDe(email('moradorz2'));
  const idDe = async (n) => (await admin.from('profiles').select('id').eq('email', email(n)).single()).data.id;
  const idAdm = await idDe('adm'), idM1 = await idDe('moradorz1');

  // Provisório, conta sem perfil e visitante (sem sessão).
  await criarUsuario(email('provz'), { name: 'QA Provisório Z', role: 'MORADOR', cadastro_validado: false });
  await criarUsuario(email('semperfilz'), null);
  const cProv = await clientDe(email('provz')), cSem = await clientDe(email('semperfilz'));
  const cVis = anon();

  // ── Regras puras (as mesmas que a tela usa) ──
  ok(isOperacao('ZELADOR') && isOperacao('SINDICO') && isOperacao('SUBSINDICO') && isOperacao('ADM') && !['PORTARIA', 'CONSELHO', 'MORADOR', undefined].some(isOperacao), `${T} operação = gestão + Zelador (nunca Portaria, Conselho, Morador)`);
  ok(isZelador('ZELADOR') && !isZelador('MORADOR'), `${T} isZelador só vale para ZELADOR`);
  ok(ROTAS_DO_ZELADOR.every((r) => rotaPermitida('ZELADOR', r)) && ['/multas', '/multas/1', '/relatorios', '/usuarios', '/autocadastro'].every((r) => !rotaPermitida('ZELADOR', r)) && rotaPermitida('SINDICO', '/usuarios'), `${T} rotas do Zelador: só as permitidas; multas, relatórios, usuários e autocadastro voltam ao Início`);
  ok(textoEmManutencao({ motivoInterdicao: 'Reforma <b>x</b>' }) === 'Em manutenção: Reforma <b>x</b>' && textoEmManutencao({ motivoInterdicao: null }) === 'Em manutenção' && textoEmManutencao({ motivoInterdicao: '  ' }) === 'Em manutenção', `${T} texto do morador: "Em manutenção: {motivo}" ou só "Em manutenção"`);
  ok(normalizarMotivo('  a\nb\t c  ') === 'a b c', `${T} motivo vira uma linha só`);
  const zUser = { id: 'z', name: 'Z', email: 'z@x.y', role: 'ZELADOR' };
  ok(avaliarVinculo('z@x.y', { id: 'u' }, [zUser], []).tipo === 'BLOQUEADO', `${T} vincular unidade a conta de Zelador é bloqueado na tela`);

  // ── 1) Convite sem unidade e hierarquia ──
  console.log('-- convite sem unidade, hierarquia e singleton');
  const conviteZ = (c, nome, mail, extra = {}) => c.from('pending_invites').insert({ nome, email: mail, role: 'ZELADOR', status: 'PENDENTE', ...extra }).select().single();
  const aceitarLink = async (link) => {
    const url = new URL(link);
    const c = anon();
    const v = await c.auth.verifyOtp({ token_hash: url.searchParams.get('token_hash'), type: url.searchParams.get('type') });
    const u = v.error ? v : await c.auth.updateUser({ password: SENHA });
    return { erro: u.error, client: c };
  };

  // Subsíndico não designa o Zelador (o convite pode entrar na fila, o envio recusa).
  // Desde a 0042 o próprio banco recusa o Subsíndico na fila (coberto na parte [68]); aqui o convite entra pelo servidor
  // para provar que a ROTA de envio também recusa.
  const convSub = await admin.from('pending_invites').insert({ nome: 'QA Zelador Sub', email: email('zelsub'), role: 'ZELADOR', status: 'PENDENTE' }).select().single();
  ok(!!(await cSub.from('pending_invites').insert({ nome: 'QA Zelador Sub2', email: email('zelsub2'), role: 'ZELADOR', status: 'PENDENTE' })).error, `${T} Subsíndico NÃO coloca convite de Zelador na fila (banco)`);
  const envSub = await api('/api/convites/enviar', { method: 'POST', cookie: ckSub, body: { ids: [convSub.data.id] } });
  ok(envSub.status === 200 && envSub.data.results[0].ok === false && /Síndico e a Administradora/.test(envSub.data.results[0].mensagem ?? ''), `${T} Subsíndico NÃO designa o Zelador → "${envSub.data?.results?.[0]?.mensagem}"`);
  ok(!(await admin.from('profiles').select('id').eq('email', email('zelsub'))).data.length, `${T} nenhuma conta foi criada para o convite recusado ao Subsíndico`);
  await admin.from('pending_invites').delete().eq('id', convSub.data.id);

  // Convite com unidade é recusado (funcionário externo).
  const convUn = await conviteZ(cAdm, 'QA Zelador Unidade', email('zelun'), { bloco: 'Q', unidade: '104', unit_id: U['104'] });
  const envUn = await api('/api/convites/enviar', { method: 'POST', cookie: ckAdm, body: { ids: [convUn.data.id] } });
  ok(envUn.data?.results?.[0]?.ok === false && /não pode ter unidade/.test(envUn.data.results[0].mensagem ?? ''), `${T} convite de Zelador com bloco/unidade é recusado → "${envUn.data?.results?.[0]?.mensagem}"`);
  await admin.from('pending_invites').delete().eq('id', convUn.data.id);

  // Quem não é Síndico/ADM nem coloca o envio na rota.
  for (const [nome, cookie] of [['Conselho', ckCons], ['Portaria', ckPort], ['Morador', ckM1]]) {
    const r = await api('/api/convites/enviar', { method: 'POST', cookie, body: { ids: [UUID0] } });
    ok(r.status === 403, `${T} ${nome} NÃO envia convite (nem de Zelador) → ${r.status}`);
  }

  // ADM designa: convite sem unidade, link real, senha pelo link, perfil nasce ZELADOR validado e sem unidade.
  const conv1 = await conviteZ(cAdm, 'QA Zelador', email('zelador'));
  ok(!conv1.error && conv1.data.unit_id === null, `${T} ADM coloca o convite do Zelador na fila, sem unidade ${conv1.error?.message ?? ''}`);
  const env1 = await api('/api/convites/enviar', { method: 'POST', cookie: ckAdm, body: { ids: [conv1.data.id] } });
  ok(env1.status === 200 && env1.data.results[0].ok === true, `${T} ADM gera o link do Zelador`);
  const link1 = env1.data.results[0].link;
  // Robô de pré-visualização abre o link antes da pessoa: não gasta o token.
  await fetch(link1, { headers: { 'user-agent': 'WhatsApp/2.23.20 A' } });
  const ac1 = await aceitarLink(link1);
  ok(!ac1.erro, `${T} Zelador define a senha pelo link real (definir-senha) ${ac1.erro?.message ?? ''}`);
  const idZ = await idDe('zelador');
  // Z-04: pela fila (cargo vago) a conta nasce DESATIVADA e só ativa no aceite do convite.
  const pZantes = (await admin.from('profiles').select('role,desativado_em,aguardando_aceite').eq('id', idZ).single()).data;
  ok(pZantes.role === 'ZELADOR' && pZantes.desativado_em !== null && pZantes.aguardando_aceite === true, `${T} Z-04 convite pela fila: a conta ZELADOR nasce desativada e aguardando o aceite`);
  const cZpre = await clientDe(email('zelador'));
  ok(!(await cZpre.from('reservations').select('id')).data?.length && !(await cZpre.from('spaces').select('id')).data?.length && !(await cZpre.rpc('unidades_para_zelador')).data?.length, `${T} Z-04 antes do aceite o convidado não lê nada nem a visão de unidades`);
  const ckZpre = await cookieDe(email('zelador'));
  ok(!!(await cZpre.rpc('interditar_espaco', { p_espaco_id: UUID0, p_ativo: false })).error, `${T} Z-04 antes do aceite o convidado não interdita espaço`);
  const aceite0 = await api('/api/usuarios/transferir-cargo/aceitar', { method: 'POST', cookie: ckZpre });
  ok(aceite0.status === 200 && aceite0.data.aplicada === true, `${T} Z-04 o aceite ativa o Zelador (${aceite0.status} ${JSON.stringify(aceite0.data)})`);
  const pZ = (await admin.from('profiles').select('*').eq('id', idZ).single()).data;
  ok(pZ.role === 'ZELADOR' && pZ.bloco === null && pZ.unidade === null && pZ.cadastro_validado === true && pZ.desativado_em === null && pZ.aguardando_aceite === false, `${T} perfil nasce ZELADOR, sem bloco/unidade, validado e ativo`);
  ok(!(await admin.from('units').select('id').eq('usuario_id', idZ)).data.length, `${T} nenhuma unidade ligada ao Zelador`);

  // Segundo Zelador ativo: recusado (por convite e pelo índice do banco).
  const conv2 = await conviteZ(cAdm, 'QA Zelador Segundo', email('zelador2x'));
  const env2 = await api('/api/convites/enviar', { method: 'POST', cookie: ckAdm, body: { ids: [conv2.data.id] } });
  ok(env2.data?.results?.[0]?.ok === false && /Já existe um usuário ativo com o perfil ZELADOR/.test(env2.data.results[0].mensagem ?? ''), `${T} segundo Zelador por convite é recusado → "${env2.data?.results?.[0]?.mensagem}"`);
  await admin.from('pending_invites').delete().eq('id', conv2.data.id);
  const dup = await criarUsuarioSemPerfil(email('zeldup'));
  const dupIns = await admin.from('profiles').insert({ id: dup, email: email('zeldup'), name: 'QA Zelador Dup', role: 'ZELADOR' });
  ok(dupIns.error?.code === '23505', `${T} índice único: segundo ZELADOR ativo recusado pelo banco (${dupIns.error?.code})`);
  await admin.from('profiles').delete().eq('id', dup);
  await admin.auth.admin.deleteUser(dup);

  // Trava de unidade: nenhuma rota liga conta ZELADOR a unidade, nem vira Zelador quem tem unidade.
  const lig = await admin.from('units').update({ usuario_id: idZ }).eq('id', U['104']);
  ok(!!lig.error && /funcionário externo/.test(lig.error.message), `${T} gatilho: ligar conta Zelador a unidade é recusado → "${lig.error?.message}"`);
  const ligAdm = await cAdm.from('units').update({ usuario_id: idZ }).eq('id', U['104']).select();
  ok(!!ligAdm.error || !ligAdm.data?.length, `${T} gatilho vale também para o ADM pelo navegador ("vincular unidade a conta existente")`);
  const comUnidade = await criarUsuario(email('morconvz'), { name: 'QA Morador Convertido', role: 'MORADOR', bloco: 'Q', unidade: '104' });
  await admin.from('units').update({ usuario_id: comUnidade }).eq('id', U['104']);
  const virar = await admin.from('profiles').update({ role: 'ZELADOR' }).eq('id', comUnidade);
  ok(!!virar.error && /não pode ter unidade/.test(virar.error.message), `${T} conta de Morador com unidade NÃO vira Zelador (gatilho) → "${virar.error?.message}"`);
  const idComUn = await criarUsuarioSemPerfil(email('zelcomun'));
  const insUn = await admin.from('profiles').insert({ id: idComUn, email: email('zelcomun'), name: 'QA x', role: 'ZELADOR', bloco: 'Q', unidade: '101' });
  ok(!!insUn.error && /não pode ter unidade/.test(insUn.error.message), `${T} perfil ZELADOR com bloco/unidade não é criado → "${insUn.error?.message}"`);
  await admin.auth.admin.deleteUser(idComUn);
  await admin.from('units').update({ usuario_id: null }).eq('id', U['104']);
  await admin.from('profiles').delete().eq('id', comUnidade);
  await admin.auth.admin.deleteUser(comUnidade);

  // ── 2) O que o Zelador CONSEGUE ──
  console.log('-- o que o Zelador consegue');
  const cZ = await clientDe(email('zelador')), ckZ = await cookieDe(email('zelador'));
  const base = { descricao: 'QA', capacidade_max: 20, horario_funcionamento: '10h-22h', taxa_limpeza: 40, regras: ['QA regra'] };
  const { data: espA } = await admin.from('spaces').insert({ ...base, nome: 'QA Z Salão', exige_aprovacao: true, faixa_gratis_ate: 5, faixa_valor: 80 }).select().single();
  const { data: espB } = await admin.from('spaces').insert({ ...base, nome: 'QA Z Quadra', exige_aprovacao: false }).select().single();
  const rv = (c, e, bloco, un, nome, d, status = 'PENDENTE', pessoas = 8) => c.from('reservations').insert({ espaco_id: e.id, espaco_nome: e.nome, bloco, unidade: un, morador_nome: nome, data: d, horario_inicio: '12:00', horario_fim: '16:00', convidados_estimados: pessoas, status }).select().single();
  const rvA = await rv(cM1, espA, 'Q', '101', 'QA moradorz1', dia(70));
  const rvB = await rv(cM2, espA, 'Q', '102', 'QA moradorz2', dia(71));
  const rvC = await rv(cM1, espA, 'Q', '101', 'QA moradorz1', dia(72));
  ok(!rvA.error && !rvB.error && !rvC.error, `${T} reservas de teste criadas pelos moradores`);

  ok((await cZ.from('reservations').select('id')).data.length >= 3, `${T} Zelador lê as reservas de todas as unidades`);
  ok((await cZ.from('spaces').select('id')).data.length >= 2, `${T} Zelador lê os espaços`);
  const aprova = await cZ.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA Zelador (ZELADOR)', data_avaliacao: new Date().toISOString(), motivo_recusa: null }).eq('id', rvA.data.id).select();
  ok(aprova.data?.length === 1 && aprova.data[0].status === 'APROVADA', `${T} Zelador aprova pedido pendente`);
  const recusa = await cZ.from('reservations').update({ status: 'RECUSADA', motivo_recusa: 'QA fora do regimento', avaliado_por: 'QA Zelador (ZELADOR)', data_avaliacao: new Date().toISOString() }).eq('id', rvB.data.id).select();
  ok(recusa.data?.length === 1 && recusa.data[0].status === 'RECUSADA', `${T} Zelador recusa pedido pendente`);
  // Cancelar pendente e aprovada, com motivo; mesma auditoria e mesmo aviso da gestão (o app grava os dois com o perfil dele).
  const cancAprov = await cZ.from('reservations').update({ status: 'CANCELADA', motivo_recusa: 'QA cancelada pelo zelador (aprovada)' }).eq('id', rvA.data.id).select();
  ok(cancAprov.data?.length === 1 && cancAprov.data[0].status === 'CANCELADA' && cancAprov.data[0].motivo_recusa === 'QA cancelada pelo zelador (aprovada)', `${T} Zelador cancela reserva JÁ APROVADA, com motivo`);
  const cancPend = await cZ.from('reservations').update({ status: 'CANCELADA', motivo_recusa: 'QA cancelada (pendente)' }).eq('id', rvC.data.id).select();
  ok(cancPend.data?.length === 1 && cancPend.data[0].status === 'CANCELADA', `${T} Zelador cancela reserva pendente`);
  const audZ = await cZ.from('audit_logs').insert({ usuario_id: (await idDe('zelador')), usuario_nome: 'QA Zelador', usuario_role: 'ZELADOR', acao: 'QA Cancelou reserva de QA Z Salão', modulo: 'RESERVAS', detalhes: { motivo: 'QA' } });
  ok(!audZ.error, `${T} Zelador grava a auditoria do cancelamento com o próprio nome e perfil ${audZ.error?.message ?? ''}`);
  const audForjado = await cZ.from('audit_logs').insert({ usuario_id: idAdm, usuario_nome: 'QA Administradora', usuario_role: 'ADM', acao: 'QA forjado', modulo: 'RESERVAS' });
  ok(!!audForjado.error, `${T} Zelador NÃO grava auditoria em nome de outra pessoa nem de outro perfil`);
  ok((await cAdm.from('audit_logs').select('id').eq('acao', 'QA Cancelou reserva de QA Z Salão')).data.length === 1, `${T} a gestão lê o registro do cancelamento feito pelo Zelador`);
  // Aviso ao morador: forma fixa de reserva da unidade (sem texto livre para todos).
  // Z-02: o aviso da decisão sai do banco (gatilho), só para a reserva decidida; o Zelador não escreve notificação nenhuma.
  const avCanc = ((await cM1.from('notifications').select('titulo,mensagem').eq('titulo', 'Reserva Cancelada')).data ?? []).filter((a) => /QA Z Salão/.test(a.mensagem));
  ok(avCanc.length === 2 && avCanc.every((a) => /QA Z Salão/.test(a.mensagem)) && !(await cM2.from('notifications').select('id').eq('titulo', 'Reserva Cancelada').like('mensagem', '%QA Z Salão%')).data.length, `${T} Z-02 o aviso do cancelamento chega ao morador da unidade (gerado pelo banco) e a mais ninguém`);
  const avAprov = (await cM1.from('notifications').select('titulo').eq('titulo', 'Reserva Aprovada!')).data ?? [];
  ok(avAprov.length >= 1, `${T} Z-02 aprovar também avisa o morador pelo banco`);
  ok(!!(await cZ.from('notifications').insert({ titulo: 'QA Reserva Cancelada', mensagem: 'QA x', tipo: 'RESERVA', unidade_alvo: '101', unidade_id_alvo: U['101'], link_destino: '/reservas' })).error, `${T} Z-02 o Zelador NÃO escreve notificação de reserva (nem para a unidade que quiser)`);
  ok(!!(await cZ.from('notifications').insert({ titulo: 'QA Aviso avulso', mensagem: 'QA x', tipo: 'AVISO', link_destino: '/mural' })).error, `${T} Z-02 o Zelador NÃO escreve aviso avulso para todos os moradores`);
  for (const [nome, linha] of [
    ['aviso geral a todos', { titulo: 'QA Geral', mensagem: 'x', tipo: 'GERAL' }],
    ['aviso para um perfil', { titulo: 'QA Perfil', mensagem: 'x', tipo: 'RESERVA', perfil_alvo: 'MORADOR' }],
    ['aviso de multa', { titulo: 'QA Multa', mensagem: 'x', tipo: 'MULTA', unidade_id_alvo: U['101'], link_destino: '/reservas' }],
    ['aviso a um usuário', { titulo: 'QA Usuário', mensagem: 'x', tipo: 'RESERVA', usuario_id_alvo: idM1, unidade_id_alvo: U['101'], link_destino: '/reservas' }],
  ]) {
    ok(!!(await cZ.from('notifications').insert(linha)).error, `${T} Zelador NÃO envia ${nome}`);
  }
  // Registrar em nome de morador (espaço que exige aprovação: o banco grava PENDENTE; sem aprovação: APROVADA).
  const emNome = await rv(cZ, espA, 'Q', '102', 'QA em nome do morador2', dia(73), 'APROVADA');
  ok(!emNome.error && emNome.data.status === 'PENDENTE', `${T} Zelador registra reserva em nome de morador (espaço com aprovação sai PENDENTE: o banco decide)`);
  const emNomeB = await rv(cZ, espB, 'Q', '101', 'QA em nome do morador1', dia(73), 'PENDENTE');
  ok(!emNomeB.error && emNomeB.data.status === 'APROVADA', `${T} em espaço sem aprovação a reserva do Zelador sai confirmada pelo banco`);
  // O aviso do pedido chega também ao Zelador (perfil ZELADOR) e a nenhum outro morador.
  ok(!(await cM1.from('notifications').insert({ titulo: 'QA Nova Solicitação Z', mensagem: 'QA', tipo: 'RESERVA', perfil_alvo: 'ZELADOR', link_destino: '/reservas' })).error, `${T} o pedido do morador avisa o perfil Zelador`);
  ok((await cZ.from('notifications').select('id').eq('titulo', 'QA Nova Solicitação Z')).data.length === 1 && !(await cM2.from('notifications').select('id').eq('titulo', 'QA Nova Solicitação Z')).data.length, `${T} só o Zelador lê o aviso do perfil dele`);
  await admin.from('notifications').insert({ titulo: 'QA só do Síndico', mensagem: 'QA', tipo: 'GERAL', perfil_alvo: 'SINDICO' });
  ok(!(await cZ.from('notifications').select('id').eq('titulo', 'QA só do Síndico')).data.length, `${T} Zelador NÃO lê aviso dirigido ao Síndico`);

  // Valor, pessoas, data, espaço, unidade, horário e nome: imutáveis para ele (gatilho).
  const alvoEdit = emNome.data.id;
  for (const [nome, patch] of [
    ['valor', { valor_uso: 0 }], ['taxa', { taxa_higienizacao: 0 }], ['pessoas', { convidados_estimados: 2 }], ['data', { data: dia(80) }],
    ['espaço', { espaco_id: espB.id }], ['unidade', { unidade: '999' }], ['bloco', { bloco: 'R' }], ['horário', { horario_inicio: '08:00' }], ['nome do morador', { morador_nome: 'QA outro' }],
  ]) {
    const r = await cZ.from('reservations').update(patch).eq('id', alvoEdit).select();
    ok(!!r.error || !r.data?.length, `${T} Zelador NÃO altera ${nome} da reserva (${r.error?.message ?? '0 linhas'})`);
  }
  const volta = await cZ.from('reservations').update({ status: 'PENDENTE' }).eq('id', rvA.data.id).select();
  ok(!!volta.error || !volta.data?.length, `${T} Zelador NÃO devolve uma reserva a pendente`);
  const apaga = await cZ.from('reservations').delete().eq('id', alvoEdit).select('id');
  ok(!apaga.data?.length && !!(await admin.from('reservations').select('id').eq('id', alvoEdit)).data.length, `${T} Zelador NÃO apaga reserva (cancelar não é apagar)`);
  const preservado = (await admin.from('reservations').select('valor_uso,convidados_estimados,data').eq('id', alvoEdit).single()).data;
  ok(Number(preservado.valor_uso) === 80 && preservado.convidados_estimados === 8 && preservado.data === dia(73), `${T} a reserva segue com o valor, as pessoas e a data que o banco gravou`);

  // Moradores e unidades: nome, telefone, e-mail e dependentes; nunca documento.
  await admin.from('units').update({ proprietario_nome: 'QA Titular', proprietario_telefone: '(11) 90000-0101', proprietario_email: 'qa-titular@example.com', moradores: [{ nome: 'QA Titular', tipo: 'TITULAR', telefone: '(11) 90000-0101', email: 'qa-titular@example.com' }, { nome: 'QA Dependente', tipo: 'DEPENDENTE', telefone: '' }] }).eq('id', U['101']);
  const { data: m101 } = await admin.from('units').select('moradores').eq('id', U['101']).single();
  await admin.from('unit_documentos').insert({ unit_id: U['101'], morador_id: m101.moradores[0].id, documento: '555.666.777-88' });
  // Z-06: o Zelador NÃO lê `units`; recebe a visão mínima (função do banco).
  ok(!(await cZ.from('units').select('id')).data?.length, `${T} Z-06 o Zelador NÃO lê a tabela units`);
  const uZ = (await cZ.rpc('unidades_para_zelador')).data?.find((x) => x.id === U['101']);
  const m0z = uZ?.moradores?.[0], m1z = uZ?.moradores?.[1];
  ok(m0z?.nome === 'QA Titular' && m0z.telefone === '(11) 90000-0101' && m0z.email === 'qa-titular@example.com' && uZ.moradores.length === 2 && m1z.nome === 'QA Dependente' && uZ.bloco === 'Q' && uZ.numero === '101', `${T} Z-06 Zelador lê nome, telefone, e-mail, vínculo e dependentes pela visão mínima`);
  ok(Object.keys(uZ).sort().join() === 'bloco,id,moradores,numero' && Object.keys(m0z).sort().join() === 'email,id,nome,telefone,tipo', `${T} Z-06 a visão traz só id, bloco, número e moradores (id, nome, tipo, telefone, e-mail)`);
  const txtZ = JSON.stringify(uZ);
  ok(!txtZ.includes('555.666') && !/rgCpf|proprietario|observacoes|animais|usuario_id|status_convite|vagas/.test(txtZ), `${T} Z-06 sem documento, proprietário, observações, animais, conta vinculada nem status de convite`);
  ok(!(await cM1.rpc('unidades_para_zelador')).data?.length && !(await cPort.rpc('unidades_para_zelador')).data?.length && !(await cSind.rpc('unidades_para_zelador')).data?.length, `${T} Z-06 só o Zelador recebe a visão mínima (Morador, Portaria e Síndico: vazia)`);
  ok(!(await cZ.from('unit_documentos').select('*')).data.length, `${T} Zelador NÃO lê a tabela de documentos`);
  ok(!!(await cZ.rpc('salvar_documentos_unidade', { p_unit_id: U['101'], p_docs: {}, p_manter: [] })).error, `${T} Zelador NÃO grava documento`);
  const edU = await cZ.from('units').update({ observacoes: 'QA' }).eq('id', U['101']).select();
  ok(!edU.data?.length && !(await cZ.from('units').insert({ bloco: 'Q', numero: '999', proprietario_nome: '', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'DESOCUPADO', moradores: [] }).select()).data?.length, `${T} Zelador NÃO cria nem edita unidade`);
  ok(!(await cZ.from('units').delete().eq('id', U['102']).select('id')).data?.length, `${T} Zelador NÃO exclui unidade`);
  ok((await cZ.rpc('diretorio_unidades')).data?.length > 0, `${T} Zelador lê o diretório de unidades`);

  // Veículos e visitantes.
  const vInsert = await cZ.from('vehicles').insert({ placa: 'QAZ1A11', marca: 'Fiat', modelo: 'Uno', cor: 'Cinza', bloco: 'Q', unidade: '101', vaga: 'G1', proprietario_nome: 'QA Titular', telefone_contato: '(11) 90000-0101', unit_id: U['101'], tipo_veiculo: 'CARRO' }).select().single();
  ok(!vInsert.error, `${T} Zelador cadastra veículo escolhendo a unidade ${vInsert.error?.message ?? ''}`);
  const vVis = await cZ.from('vehicles').insert({ placa: 'QAZ2B22', marca: 'Fiat', modelo: 'Mobi', cor: 'Azul', bloco: 'Q', unidade: '102', vaga: 'Visitante', proprietario_nome: 'QA Visita', telefone_contato: '(11) 90000-0102', unit_id: U['102'], tipo_veiculo: 'CARRO', status: 'VISITANTE' }).select().single();
  ok(!vVis.error && vVis.data.status === 'VISITANTE', `${T} Zelador cadastra visitante`);
  ok((await cZ.from('vehicles').select('id')).data.length >= 2, `${T} Zelador vê os veículos`);
  ok(!(await cZ.from('vehicles').update({ cor: 'Preto' }).eq('id', vInsert.data.id).select()).data?.length, `${T} Zelador NÃO edita veículo`);
  ok(!(await cZ.from('vehicles').delete().eq('id', vInsert.data.id).select('id')).data?.length, `${T} Zelador NÃO remove veículo`);

  // Mural e links.
  const pubOk = await cZ.from('notices').insert({ titulo: 'QA Aviso do Zelador', conteudo: 'QA texto', categoria: 'MANUTENCAO', autor: 'QA Zelador', fixado: false }).select().single();
  ok(!pubOk.error, `${T} Zelador publica aviso com o próprio nome ${pubOk.error?.message ?? ''}`);
  for (const [nome, linha] of [
    ['categoria URGENTE', { titulo: 'QA Urgente', conteudo: 'x', categoria: 'URGENTE' }],
    ['categoria ASSEMBLEIA', { titulo: 'QA Assembleia', conteudo: 'x', categoria: 'ASSEMBLEIA' }],
    ['anexo com link', { titulo: 'QA Anexo', conteudo: 'x', categoria: 'COMUNICADO', anexo_nome: 'x.pdf', anexo_url: 'https://example.com/x' }],
    ['título gigante', { titulo: 'T'.repeat(121), conteudo: 'x', categoria: 'COMUNICADO' }],
    ['conteúdo gigante', { titulo: 'QA Grande', conteudo: 'c'.repeat(2001), categoria: 'COMUNICADO' }],
  ]) ok(!!(await cZ.from('notices').insert({ ...linha, autor: 'QA Zelador', fixado: false })).error, `${T} Z-02 Zelador NÃO publica aviso com ${nome}`);
  const invis = await cZ.from('notices').insert({ titulo: 'QA\u202E invertido\u200B', conteudo: 'texto\u200F limpo', categoria: 'COMUNICADO', autor: 'QA Zelador', fixado: false }).select().single();
  ok(!invis.error && invis.data.titulo === 'QA invertido' && invis.data.conteudo === 'texto limpo', `${T} Z-05 caracteres invisíveis e de direção saem do aviso do Zelador`);
  ok(!!(await cZ.from('notices').insert({ titulo: 'QA Fixado', conteudo: 'x', categoria: 'COMUNICADO', autor: 'QA Zelador', fixado: true })).error, `${T} Zelador NÃO fixa aviso`);
  ok(!!(await cZ.from('notices').insert({ titulo: 'QA Autor falso', conteudo: 'x', categoria: 'COMUNICADO', autor: 'QA Administradora', fixado: false })).error, `${T} Zelador NÃO publica em nome de outra pessoa`);
  const sinoMural = (await cM1.from('notifications').select('titulo,mensagem').like('titulo', 'Novo comunicado: QA Aviso do Zelador%')).data ?? [];
  ok(sinoMural.length === 1 && /Comunicado|Manutenção/.test(sinoMural[0].mensagem), `${T} Z-02 o aviso do Zelador gera o sino por gatilho, com texto fixo`);
  await admin.from('notices').insert({ titulo: 'QA Aviso da gestão', conteudo: 'x', categoria: 'COMUNICADO', autor: 'QA Síndico', fixado: false });
  const { data: avG } = await admin.from('notices').select('id').eq('titulo', 'QA Aviso da gestão').single();
  ok((await cZ.from('notices').select('id')).data.length >= 2, `${T} Zelador lê o mural`);
  ok(!(await cZ.from('notices').delete().eq('id', avG.id).select('id')).data?.length && !(await cZ.from('notices').update({ titulo: 'QA mudou' }).eq('id', avG.id).select()).data?.length, `${T} Zelador NÃO apaga nem edita aviso de outra pessoa`);
  // L4: o Zelador edita e apaga só os avisos que ELE publicou.
  const edProprio = await cZ.from('notices').update({ titulo: 'QA Aviso do Zelador editado' }).eq('id', pubOk.data.id).select();
  ok(edProprio.data?.length === 1 && edProprio.data[0].titulo === 'QA Aviso do Zelador editado', `${T} L4 Zelador edita o aviso que ele mesmo publicou`);
  ok(!(await cZ.from('notices').update({ categoria: 'URGENTE' }).eq('id', pubOk.data.id).select()).data?.length, `${T} L4 ...mas não o transforma em Urgente`);
  ok(!(await cZ.from('notices').update({ autor: 'QA Administradora' }).eq('id', pubOk.data.id).select()).data?.length, `${T} L4 ...nem troca o autor`);
  ok(!(await cPort.from('notices').update({ titulo: 'QA x' }).eq('id', pubOk.data.id).select()).data?.length, `${T} L4 Portaria NÃO edita aviso do Zelador`);
  const apProprio = await cZ.from('notices').delete().eq('id', invis.data.id).select('id');
  ok(apProprio.data?.length === 1, `${T} L4 Zelador apaga o aviso que ele mesmo publicou`);
  await admin.from('documents').insert({ titulo: 'QA Documento Z', descricao: 'x', categoria: 'REGIMENTO', link_externo: 'https://example.com/qa' });
  ok((await cZ.from('documents').select('id').eq('titulo', 'QA Documento Z')).data.length === 1, `${T} Zelador lê Links e Documentos`);
  ok(!!(await cZ.from('documents').insert({ titulo: 'QA Doc Z', descricao: 'x', categoria: 'ATA', link_externo: 'https://example.com' })).error && !(await cZ.from('documents').delete().eq('titulo', 'QA Documento Z').select('id')).data?.length, `${T} Zelador NÃO escreve em Links e Documentos`);
  ok(!(await cZ.from('zelador').update({ nome: 'QA' }).eq('id', 1).select()).data?.length, `${T} Zelador NÃO edita o cadastro de contato (fase 2)`);

  // ── 3) Escalada: o que o Zelador NÃO consegue ──
  console.log('-- escalada: o que o Zelador NÃO consegue');
  // Multa de teste e histórico para provar que ele não lê.
  const { data: fineQ } = await admin.from('fines').insert({ numero_protocolo: 'QA-Z1', bloco: 'Q', unidade: '101', unit_id: U['101'], morador_nome: 'QA moradorz1', data_infracao: dia(0), prazo_recurso_data: dia(10), artigo_regimento: 'Art. 1', descricao_infracao: 'QA sigilosa', valor: 100, tipo: 'MULTA' }).select().single();
  ok(!(await cZ.from('fines').select('id')).data.length, `${T} Zelador NÃO lê multa (nem situação financeira)`);
  ok(!!(await cZ.from('fines').insert({ numero_protocolo: 'QA-Z2', bloco: 'Q', unidade: '101', unit_id: U['101'], morador_nome: 'QA', data_infracao: dia(0), prazo_recurso_data: dia(10), artigo_regimento: 'Art. 1', descricao_infracao: 'x', valor: 1, tipo: 'MULTA' })).error, `${T} Zelador NÃO emite multa`);
  ok(!(await cZ.from('fines').update({ valor: 0 }).eq('id', fineQ?.id).select()).data?.length && !(await cZ.from('fines').delete().eq('id', fineQ?.id).select('id')).data?.length, `${T} Zelador NÃO altera nem apaga multa`);
  ok(!(await cZ.from('audit_logs').select('id').neq('usuario_role', 'ZELADOR')).data.length && !(await cZ.from('audit_logs').select('id')).data.length, `${T} Zelador NÃO lê o histórico de ações (nem o próprio)`);
  ok(!(await cZ.from('autocadastros').select('id')).data.length, `${T} Zelador NÃO lê autocadastros`);
  ok(!(await cZ.from('pending_invites').select('id')).data.length && !!(await cZ.from('pending_invites').insert({ nome: 'QA x', email: email('zinv'), role: 'ADM', status: 'PENDENTE' })).error, `${T} Zelador NÃO lê nem cria convites`);
  const perfisVistos = (await cZ.from('profiles').select('id,email')).data ?? [];
  ok(perfisVistos.length === 1 && perfisVistos[0].id === idZ, `${T} Zelador NÃO lê perfil de terceiros (só o próprio)`);
  ok(!(await cZ.from('cargo_transferencias').select('id')).data.length, `${T} Zelador NÃO lê transferências de cargo`);
  ok(!(await cZ.from('space_blocks').select('espaco_a')).data.length, `${T} Zelador NÃO lê os bloqueios entre espaços`);
  ok(!!(await cZ.from('autocadastro_config').update({ aberto: false }).eq('id', 1).select()).error === false && (await admin.from('autocadastro_config').select('aberto').eq('id', 1).single()).data.aberto === true, `${T} Zelador NÃO abre nem fecha o autocadastro`);
  // Virar outro perfil.
  for (const patch of [{ role: 'ADM' }, { role: 'SINDICO' }, { role: 'SUBSINDICO' }, { role: 'MORADOR' }, { cadastro_validado: false }, { desativado_em: null }]) await cZ.from('profiles').update(patch).eq('id', idZ);
  ok((await admin.from('profiles').select('role,cadastro_validado,desativado_em').eq('id', idZ).single()).data.role === 'ZELADOR', `${T} Zelador NÃO vira ADM, Síndico, Subsíndico nem Morador (profiles é só leitura)`);
  ok(!!(await cZ.from('profiles').insert({ id: UUID0, name: 'x', role: 'ADM', email: 'x@y.zz' })).error, `${T} Zelador NÃO cria perfil`);
  // Funções de cargo e documento.
  for (const [nome, r] of [
    ['transferir_cargo', await cZ.rpc('transferir_cargo', { p_executor: idZ, p_cargo: 'CONSELHO', p_origem: idZ, p_destino: idM1 })],
    ['iniciar_transferencia_cargo', await cZ.rpc('iniciar_transferencia_cargo', { p_executor: idZ, p_cargo: 'ZELADOR', p_origem: idZ, p_destino_id: UUID0, p_nome: 'x y', p_email: 'x@y.zz', p_telefone: '', p_link: 'x' })],
    ['cancelar_transferencia_cargo', await cZ.rpc('cancelar_transferencia_cargo', { p_executor: idZ, p_transferencia: UUID0 })],
    ['aceitar_transferencia_cargo', await cZ.rpc('aceitar_transferencia_cargo', { p_usuario: idZ })],
    ['reativar_acesso_zelador', await cZ.rpc('reativar_acesso_zelador', { p_executor: idZ, p_alvo: idZ })],
    ['encerrar_sessoes_usuario', await cZ.rpc('encerrar_sessoes_usuario', { p_usuario: idM1 })],
    ['definir_bloqueios_espaco', await cZ.rpc('definir_bloqueios_espaco', { p_espaco_id: espA.id, p_outros: [espB.id] })],
  ]) ok(!!r.error, `${T} Zelador NÃO chama ${nome}`);
  // APIs administrativas.
  const apis = [
    ['/api/convites/enviar', { ids: [UUID0] }], ['/api/usuarios/excluir', { userId: idM1 }], ['/api/usuarios/resetar-senha', { userId: idM1 }],
    ['/api/usuarios/transferir-cargo', { cargo: 'CONSELHO', origemId: idZ, destino: { tipo: 'NOVO', nome: 'QA x y', email: 'xy@qa.example' } }],
    ['/api/usuarios/transferir-cargo/cancelar', { transferenciaId: UUID0 }], ['/api/autocadastro/decidir', { ids: [UUID0], acao: 'VALIDAR' }],
    ['/api/unidades/excluir', { unitId: U['102'] }], ['/api/usuarios/reativar-zelador', { userId: idZ }],
  ];
  for (const [rota, corpo] of apis) {
    const r = await api(rota, { method: 'POST', cookie: ckZ, body: corpo });
    ok(r.status === 403, `${T} Zelador na API ${rota} → ${r.status}`);
  }
  ok((await admin.from('profiles').select('id').eq('id', idM1)).data.length === 1, `${T} as tentativas do Zelador não excluíram ninguém`);
  // Espaços: só leitura e interdição.
  const antesEsp = (await admin.from('spaces').select('*').eq('id', espA.id).single()).data;
  for (const [nome, patch] of [['valor de higienização', { taxa_limpeza: 0 }], ['faixa', { faixa_gratis_ate: 1, faixa_valor: 1 }], ['aprovação', { exige_aprovacao: false }], ['nome', { nome: 'QA mudou' }], ['capacidade', { capacidade_max: 1 }], ['ativo', { ativo: false }], ['motivo', { motivo_interdicao: 'QA direto' }]]) {
    const r = await cZ.from('spaces').update(patch).eq('id', espA.id).select();
    ok(!!r.error || !r.data?.length, `${T} Zelador NÃO altera ${nome} do espaço direto na tabela`);
  }
  ok(!!(await cZ.from('spaces').insert({ ...base, nome: 'QA Z Novo' })).error, `${T} Zelador NÃO cadastra espaço`);
  ok(!(await cZ.from('spaces').delete().eq('id', espB.id).select('id')).data?.length, `${T} Zelador NÃO exclui espaço`);
  ok(JSON.stringify((await admin.from('spaces').select('*').eq('id', espA.id).single()).data) === JSON.stringify(antesEsp), `${T} o espaço continua exatamente como estava`);
  // Perfis sem acesso: Portaria, Conselho, Morador, provisório e visitante não ganharam nada.
  ok(!(await cPort.from('reservations').update({ status: 'CANCELADA' }).eq('id', emNome.data.id).select()).data?.length && !(await cCons.from('reservations').update({ status: 'CANCELADA' }).eq('id', emNome.data.id).select()).data?.length && !(await cM1.from('reservations').update({ status: 'CANCELADA' }).eq('id', emNome.data.id).select()).data?.length, `${T} Portaria, Conselho e Morador NÃO cancelam reserva de outra unidade (sem poder novo)`);
  for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons], ['Morador', cM1], ['provisório', cProv]]) {
    ok(!!(await c.from('notices').insert({ titulo: 'QA x', conteudo: 'x', categoria: 'COMUNICADO', autor: nome, fixado: false })).error, `${T} ${nome} NÃO publica aviso`);
  }
  ok(!!(await cCons.from('vehicles').insert({ placa: 'QAZ9X99', marca: 'x', modelo: 'y', cor: 'z', bloco: 'Q', unidade: '101', vaga: 'x', proprietario_nome: 'x', telefone_contato: 'x', unit_id: U['101'], tipo_veiculo: 'CARRO' })).error, `${T} Conselho segue sem cadastrar veículo`);
  ok(!(await cPort.from('unit_documentos').select('*')).data.length && !(await cCons.from('unit_documentos').select('*')).data.length, `${T} Portaria e Conselho seguem sem ler documento`);
  ok((await cPort.from('units').select('id')).data.length > 0 && (await cCons.from('audit_logs').select('id')).error === null, `${T} Portaria segue lendo unidades; Conselho segue lendo a auditoria`);

  // ── 4) Interdição ──
  console.log('-- interdição de espaço');
  const { data: espI } = await admin.from('spaces').insert({ ...base, nome: 'QA Z Interdição', exige_aprovacao: true, faixa_gratis_ate: 5, faixa_valor: 80 }).select().single();
  const { data: espJ } = await admin.from('spaces').insert({ ...base, nome: 'QA Z Interdição Livre', exige_aprovacao: false }).select().single();
  const iA = await rv(cM1, espI, 'Q', '101', 'QA moradorz1', dia(75));
  const iB = await rv(cM2, espI, 'Q', '102', 'QA moradorz2', dia(76));
  await admin.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA Síndico (SINDICO)', data_avaliacao: new Date().toISOString() }).eq('id', iB.data.id);
  const iC = await rv(cM1, espJ, 'Q', '101', 'QA moradorz1', dia(77));
  ok(!iA.error && !iB.error && !iC.error, `${T} reservas futuras de teste (pendente, aprovada e automática)`);
  ok(reservasFuturasDoEspaco((await admin.from('reservations').select('*').eq('espaco_id', espI.id)).data.map((r) => ({ id: r.id, espacoId: r.espaco_id, status: r.status, data: r.data, horarioInicio: r.horario_inicio })), espI.id, dia(0)).length === 2, `${T} contagem de reservas futuras do espaço = 2 (pendente + aprovada)`);

  const fotoReservas = async () => JSON.stringify((await admin.from('reservations').select('*').in('espaco_id', [espI.id, espJ.id]).order('id')).data);
  const contaNotif = async () => (await admin.from('notifications').select('id', { count: 'exact', head: true })).count;
  const reservasAntes = await fotoReservas(), notifAntes = await contaNotif();
  const espAntes = (await admin.from('spaces').select('*').eq('id', espI.id).single()).data;

  const r1 = await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false, p_motivo: '  Reforma\nda   piscina até 20/10  ' });
  ok(!r1.error && r1.data?.ok === true && r1.data.alterado === true, `${T} Zelador interdita o espaço ${r1.error?.message ?? ''}`);
  const espDepois = (await admin.from('spaces').select('*').eq('id', espI.id).single()).data;
  const { ativo: a0, ...resto0 } = espAntes; delete resto0.motivo_interdicao; const { ativo: a1, motivo_interdicao: m1, ...resto1 } = espDepois;
  ok(a0 === true && a1 === false && m1 === 'Reforma da piscina até 20/10' && JSON.stringify(resto0) === JSON.stringify(resto1), `${T} a função altera SÓ ativo e motivo (quebras e espaços viram uma linha: "${m1}")`);
  ok((await fotoReservas()) === reservasAntes, `${T} nenhuma reserva existente (pendente ou aprovada) mudou de status, data, valor ou qualquer campo`);
  ok((await contaNotif()) === notifAntes, `${T} interditar NÃO cria notificação`);
  const logI = (await admin.from('audit_logs').select('*').eq('acao', 'Interditou o espaço QA Z Interdição')).data;
  ok(logI.length === 1 && logI[0].usuario_role === 'ZELADOR' && logI[0].usuario_nome === 'QA Zelador' && logI[0].detalhes.motivo === 'Reforma da piscina até 20/10' && logI[0].detalhes.espacoId === espI.id, `${T} a auditoria registra quem interditou, o espaço e o motivo`);
  ok(!JSON.stringify(logI[0]).match(/@|\(\d{2}\)/), `${T} a auditoria da interdição não guarda e-mail nem telefone`);
  const { data: infoZ } = await cZ.rpc('interdicoes_atuais');
  ok(infoZ?.length === 1 && infoZ[0].por_nome === 'QA Zelador' && infoZ[0].espaco_id === espI.id, `${T} a equipe vê "interditado por" (QA Zelador) e quando`);
  ok(!(await cM1.rpc('interdicoes_atuais')).data?.length && !(await cPort.rpc('interdicoes_atuais')).data?.length, `${T} o morador (e a Portaria) NÃO vê quem interditou`);

  // Morador lê o motivo, mas não escreve.
  ok((await cM1.from('spaces').select('ativo,motivo_interdicao').eq('id', espI.id).single()).data.motivo_interdicao === 'Reforma da piscina até 20/10', `${T} o morador LÊ o motivo da interdição`);
  const mEsc = await cM1.from('spaces').update({ motivo_interdicao: 'QA do morador' }).eq('id', espI.id).select();
  const mEsc2 = await cM1.from('spaces').update({ ativo: true }).eq('id', espI.id).select();
  ok((!!mEsc.error || !mEsc.data?.length) && (!!mEsc2.error || !mEsc2.data?.length), `${T} o morador NÃO escreve o motivo nem reabre o espaço (UPDATE direto)`);

  // Novo pedido é recusado pelo banco para TODOS os perfis; as decisões nas reservas existentes seguem valendo.
  const novos = [['Morador', cM1, 'Q', '101'], ['Portaria', cPort, 'Q', '102'], ['Conselho', cCons, 'Q', '102'], ['Zelador', cZ, 'Q', '102'], ['Síndico', cSind, 'Q', '102'], ['Subsíndico', cSub, 'Q', '102'], ['ADM', cAdm, 'Q', '102']];
  for (const [nome, c, b, un] of novos) {
    const r = await rv(c, espI, b, un, `QA novo ${nome}`, dia(90));
    ok(r.error?.message === 'reserva_espaco_indisponivel', `${T} novo pedido de ${nome} em espaço interditado é recusado pelo banco (${r.error?.message})`);
  }
  ok(!(await admin.from('reservations').select('id').like('morador_nome', 'QA novo %')).data.length, `${T} nenhum pedido novo entrou no espaço interditado`);
  const aprovI = await cZ.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA Zelador (ZELADOR)', data_avaliacao: new Date().toISOString() }).eq('id', iA.data.id).select();
  ok(aprovI.data?.length === 1, `${T} aprovar reserva existente em espaço interditado continua funcionando`);
  const recI = await cSind.from('reservations').update({ status: 'RECUSADA', motivo_recusa: 'QA' }).eq('id', iA.data.id).select();
  ok(recI.data?.length === 1, `${T} recusar/cancelar reserva existente em espaço interditado continua funcionando (gestão)`);
  const cancI = await cZ.from('reservations').update({ status: 'CANCELADA', motivo_recusa: 'QA espaço em manutenção' }).eq('id', iB.data.id).select();
  ok(cancI.data?.length === 1, `${T} Zelador cancela manualmente a reserva futura aprovada do espaço interditado`);
  await admin.from('reservations').update({ status: 'PENDENTE', motivo_recusa: null }).eq('id', iA.data.id);

  // Motivo: tamanho, perfis, texto puro.
  const m140 = 'a'.repeat(140), m141 = 'a'.repeat(141);
  const g140 = await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false, p_motivo: m140 });
  ok(!g140.error && (await admin.from('spaces').select('motivo_interdicao').eq('id', espI.id).single()).data.motivo_interdicao === m140, `${T} motivo de 140 caracteres é gravado`);
  const g141 = await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false, p_motivo: m141 });
  ok(!!g141.error && /motivo_muito_longo/.test(g141.error.message) && (await admin.from('spaces').select('motivo_interdicao').eq('id', espI.id).single()).data.motivo_interdicao === m140, `${T} motivo de 141 caracteres é recusado e o anterior fica`);
  const gHtml = await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false, p_motivo: '<img src=x onerror=alert(1)> <b>x</b>' });
  ok(!gHtml.error && (await admin.from('spaces').select('motivo_interdicao').eq('id', espI.id).single()).data.motivo_interdicao === '<img src=x onerror=alert(1)> <b>x</b>' && textoEmManutencao({ motivoInterdicao: '<b>x</b>' }) === 'Em manutenção: <b>x</b>', `${T} HTML no motivo é gravado como texto puro (a tela mostra escapado, nunca como HTML)`);
  const gVazio = await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false, p_motivo: '  \n  ' });
  ok(!gVazio.error && (await admin.from('spaces').select('motivo_interdicao').eq('id', espI.id).single()).data.motivo_interdicao === null, `${T} motivo só com espaços/quebras vira "sem motivo" (só "Em manutenção")`);
  for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm]]) {
    const r = await c.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false, p_motivo: `QA motivo ${nome}` });
    ok(!r.error && (await admin.from('spaces').select('motivo_interdicao').eq('id', espI.id).single()).data.motivo_interdicao === `QA motivo ${nome}`, `${T} ${nome} grava o motivo da interdição`);
  }
  const logsM = (await admin.from('audit_logs').select('usuario_role,detalhes,acao').like('acao', 'Alterou o motivo da interdição do espaço QA Z Interdição')).data;
  ok(logsM.some((l) => l.usuario_role === 'SUBSINDICO' && l.detalhes.motivo === 'QA motivo Subsíndico') && logsM.some((l) => l.usuario_role === 'ZELADOR'), `${T} cada mudança de motivo fica na auditoria com quem escreveu`);
  for (const [nome, c] of [['Morador', cM1], ['Portaria', cPort], ['Conselho', cCons], ['provisório', cProv], ['conta sem perfil', cSem], ['visitante', cVis]]) {
    const r = await c.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false, p_motivo: 'QA indevido' });
    const depois = (await admin.from('spaces').select('ativo,motivo_interdicao').eq('id', espI.id).single()).data;
    ok(!!r.error && (r.error.code === '42501' || r.error.code === 'PGRST301' || r.error.code === '401' || /permission|permiss|jwt/i.test(r.error.message)) && depois.motivo_interdicao !== 'QA indevido', `${T} ${nome} NÃO interdita nem escreve motivo (${r.error?.code})`);
  }
  ok(!!(await cSind.from('spaces').update({ ativo: true }).eq('id', espI.id)).error, `${T} nem a gestão altera "ativo" direto na tabela: só pela função (que audita)`);
  ok(!!(await cSind.from('spaces').update({ motivo_interdicao: 'QA direto' }).eq('id', espI.id)).error, `${T} nem a gestão grava o motivo direto na tabela`);
  const editForm = await cSind.from('spaces').update({ taxa_limpeza: 55 }).eq('id', espI.id).select();
  ok(editForm.data?.length === 1 && Number(editForm.data[0].taxa_limpeza) === 55 && editForm.data[0].ativo === false, `${T} a gestão segue editando os dados do espaço (valor) sem reabri-lo`);

  // Reativar limpa o motivo e volta a aceitar pedidos; só a função reabre.
  const rb = await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: true, p_motivo: 'QA deve ser ignorado' });
  const espReaberto = (await admin.from('spaces').select('ativo,motivo_interdicao').eq('id', espI.id).single()).data;
  ok(!rb.error && espReaberto.ativo === true && espReaberto.motivo_interdicao === null, `${T} reabrir o espaço limpa o motivo (mesmo que venha texto)`);
  ok((await fotoReservas()).length > 0 && !(await cZ.rpc('interdicoes_atuais')).data?.length, `${T} reaberto, o espaço sai da lista de interditados`);
  const dep = await rv(cM1, espI, 'Q', '101', 'QA depois de reabrir', dia(91));
  ok(!dep.error, `${T} com o espaço reaberto o mesmo pedido do morador passa`);
  const again = await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: true });
  ok(!again.error && again.data.alterado === false, `${T} reabrir um espaço já aberto não muda nada nem audita de novo`);
  ok(!!(await cZ.rpc('interditar_espaco', { p_espaco_id: UUID0, p_ativo: false })).error, `${T} espaço que não existe é recusado`);
  ok(!!(await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: null })).error, `${T} estado em branco é recusado`);

  // ── 5) Saída do cargo ──
  console.log('-- saída do cargo: acesso removido');
  const tr = (cookie, corpo) => api('/api/usuarios/transferir-cargo', { method: 'POST', cookie, body: corpo });
  const novoZ = (n, mail) => ({ tipo: 'NOVO', nome: n, email: mail, telefone: '' });
  ok((await tr(ckSub, { cargo: 'ZELADOR', origemId: idZ, destino: novoZ('QA Zelador Dois', email('zelador2')) })).status === 403, `${T} Subsíndico NÃO transfere o Zelador → 403`);
  ok((await tr(ckZ, { cargo: 'ZELADOR', origemId: idZ, destino: novoZ('QA Zelador Dois', email('zelador2')) })).status === 403, `${T} Zelador NÃO transfere o próprio cargo → 403`);
  const exist = await tr(ckAdm, { cargo: 'ZELADOR', origemId: idZ, destino: { tipo: 'EXISTENTE', id: idM1 } });
  ok(exist.status === 400 && exist.data.codigo === 'cargo_invalido' && /pessoa nova/.test(exist.data.error), `${T} Zelador só por pessoa NOVA: conta existente recusada → ${exist.status} "${exist.data?.error}"`);
  const rpcExist = await admin.rpc('transferir_cargo', { p_executor: idAdm, p_cargo: 'ZELADOR', p_origem: idZ, p_destino: idM1 });
  ok(rpcExist.data?.ok === false && rpcExist.data.codigo === 'cargo_invalido', `${T} a função do banco também recusa destino existente para o Zelador`);
  const emailTem = await tr(ckAdm, { cargo: 'ZELADOR', origemId: idZ, destino: novoZ('QA Já Tem Conta', email('moradorz2')) });
  ok(emailTem.status === 409 && emailTem.data.codigo === 'email_com_conta', `${T} e-mail que já tem conta não vira Zelador → ${emailTem.status}`);
  const conselhoNaoTem = await tr(ckSind, { cargo: 'ZELADOR', origemId: idM1, destino: novoZ('QA x', email('zelx')) });
  ok(conselhoNaoTem.status === 409 && conselhoNaoTem.data.codigo === 'origem_desatualizada', `${T} origem que não é Zelador é recusada → ${conselhoNaoTem.status}`);

  // Cancelar uma indicação: a conta provisória some e o Zelador atual segue.
  const t3 = await tr(ckSind, { cargo: 'ZELADOR', origemId: idZ, destino: novoZ('QA Zelador Tres', email('zelador3')) });
  ok(t3.status === 200 && t3.data.tipo === 'NOVO' && !!t3.data.link, `${T} Síndico indica novo Zelador (pessoa nova) → convite pendente`);
  const id3 = (await admin.from('profiles').select('id,role,desativado_em,cadastro_validado').eq('email', email('zelador3')).single()).data;
  ok(id3.role === 'MORADOR' && id3.desativado_em !== null && id3.cadastro_validado === false, `${T} enquanto o convite não é aceito, a conta nova nasce DESATIVADA (sem acesso a nada)`);
  ok((await admin.from('profiles').select('desativado_em').eq('id', idZ).single()).data.desativado_em === null, `${T} o Zelador atual continua ativo até o aceite`);
  ok(!(await cZ.from('cargo_transferencias').select('id')).data.length && (await cAdm.from('cargo_transferencias').select('id').eq('cargo', 'ZELADOR')).data.length === 1, `${T} Zelador NÃO lê a transferência que o envolve; a gestão lê`);
  const dupPend = await tr(ckAdm, { cargo: 'ZELADOR', origemId: idZ, destino: novoZ('QA Quatro', email('zelador4')) });
  ok(dupPend.status === 409 && dupPend.data.codigo === 'pendencia_existente', `${T} uma pendência por cargo único → ${dupPend.status}`);
  ok(!(await admin.from('profiles').select('id').eq('email', email('zelador4'))).data.length, `${T} a recusa não deixa conta criada`);
  const ac3 = await aceitarLink(t3.data.link);
  ok(!ac3.erro, `${T} a pessoa do convite define a senha`);
  ok(!(await ac3.client.from('units').select('id')).data?.length && !(await ac3.client.rpc('diretorio_unidades')).data?.length && !(await ac3.client.from('reservations').select('id')).data?.length, `${T} antes do aceite do cargo a conta nova não vê unidades, diretório nem reservas`);
  const pend3 = (await admin.from('cargo_transferencias').select('id').eq('cargo', 'ZELADOR').eq('status', 'PENDENTE').single()).data;
  const canc = await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie: ckSub, body: { transferenciaId: pend3.id } });
  ok(canc.status === 403, `${T} Subsíndico NÃO cancela a indicação → ${canc.status}`);
  const canc2 = await api('/api/usuarios/transferir-cargo/cancelar', { method: 'POST', cookie: ckAdm, body: { transferenciaId: pend3.id } });
  ok(canc2.status === 200 && !(await admin.from('profiles').select('id').eq('email', email('zelador3'))).data.length, `${T} ADM cancela a indicação: a conta provisória some`);
  ok((await admin.from('profiles').select('desativado_em,role').eq('id', idZ).single()).data.desativado_em === null, `${T} cancelar não muda o Zelador atual`);

  // Indicação concluída: o Zelador sai com o acesso removido.
  await admin.from('audit_logs').insert({ usuario_id: idZ, usuario_nome: 'QA Zelador', usuario_role: 'ZELADOR', acao: 'QA Ação histórica do Zelador', modulo: 'RESERVAS' });
  const t2 = await tr(ckAdm, { cargo: 'ZELADOR', origemId: idZ, destino: novoZ('QA Zelador Dois', email('zelador2')) });
  ok(t2.status === 200 && !!t2.data.link, `${T} ADM indica o novo Zelador`);
  const ac2 = await aceitarLink(t2.data.link);
  let ckZ2 = await cookieDe(email('zelador2'));
  const aceita = await api('/api/usuarios/transferir-cargo/aceitar', { method: 'POST', cookie: ckZ2 });
  ckZ2 = await cookieDe(email('zelador2')); // o aceite encerra as sessões antigas da conta (0042): entra de novo
  ok(aceita.status === 200 && aceita.data.aplicada === true && aceita.data.origemAcessoRemovido === true, `${T} aceite aplica o cargo e remove o acesso de quem saiu (${aceita.status} ${JSON.stringify(aceita.data)})`);
  ok(!ac2.erro, `${T} novo Zelador definiu a senha pelo link`);
  const idZ2 = await idDe('zelador2');
  const pAnt = (await admin.from('profiles').select('*').eq('id', idZ).single()).data;
  const pNovo = (await admin.from('profiles').select('*').eq('id', idZ2).single()).data;
  ok(pNovo.role === 'ZELADOR' && pNovo.cadastro_validado === true && pNovo.desativado_em === null && pNovo.bloco === null && pNovo.unidade === null, `${T} novo Zelador: papel, validado, ativo, sem unidade`);
  ok(pAnt.role === 'ZELADOR' && pAnt.desativado_em !== null, `${T} ex-Zelador: conta DESATIVADA (não excluída), papel preservado, NÃO vira Morador nem provisório`);
  ok(pAnt.cadastro_validado === true, `${T} ex-Zelador não vira "provisório" (cadastro_validado continua verdadeiro e a conta nem tem perfil ativo)`);
  ok((await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'ZELADOR').is('desativado_em', null)).count === 1, `${T} exatamente um Zelador ativo (a trava vale só para ativos)`);
  ok((await admin.from('audit_logs').select('id').eq('acao', 'QA Ação histórica do Zelador')).data.length === 1, `${T} o histórico de ações do ex-Zelador permanece`);
  const logT = ((await admin.from('audit_logs').select('acao,detalhes').like('acao', 'Aceitou o convite e assumiu o cargo de Zelador%')).data ?? []).filter((l) => l.detalhes.origemAcessoRemovido === true);
  ok(logT.length === 1 && logT[0].detalhes.origemAcessoRemovido === true && !/@|\(\d{2}\)/.test(JSON.stringify(logT)), `${T} a auditoria grava "acesso removido" sem e-mail nem telefone`);
  const avisoGestao = (await admin.from('notifications').select('titulo,mensagem,perfil_alvo').eq('titulo', 'Acesso do Zelador removido')).data;
  ok(avisoGestao.length >= 1 && avisoGestao[0].perfil_alvo === 'SINDICO' && /acesso de QA Zelador como Zelador foi removido/.test(avisoGestao[0].mensagem), `${T} Síndico e ADM são avisados: "${avisoGestao[0]?.mensagem}"`);
  ok((await cSind.from('notifications').select('id').eq('titulo', 'Acesso do Zelador removido')).data.length >= 1 && (await cAdm.from('notifications').select('id').eq('titulo', 'Acesso do Zelador removido')).data.length >= 1, `${T} Síndico e ADM leem o aviso`);

  // A sessão antiga do ex-Zelador deixa de valer na próxima requisição.
  for (const [nome, q] of [
    ['units', cZ.from('units').select('id')], ['reservations', cZ.from('reservations').select('id')], ['spaces', cZ.from('spaces').select('id')],
    ['notices', cZ.from('notices').select('id')], ['vehicles', cZ.from('vehicles').select('id')], ['documents', cZ.from('documents').select('id')], ['profiles (o próprio)', cZ.from('profiles').select('id')],
  ]) ok(!(await q).data?.length, `${T} ex-Zelador com a sessão antiga: ${nome} devolve vazio`);
  ok(!(await cZ.rpc('diretorio_unidades')).data?.length, `${T} ex-Zelador NÃO vê o diretório de unidades (nunca vira provisório)`);
  ok(!!(await cZ.rpc('interditar_espaco', { p_espaco_id: espI.id, p_ativo: false })).error, `${T} ex-Zelador NÃO interdita espaço`);
  ok(!(await cZ.from('reservations').update({ status: 'CANCELADA' }).eq('id', iA.data.id).select()).data?.length, `${T} ex-Zelador NÃO decide reserva`);
  ok(!!(await cZ.from('notices').insert({ titulo: 'QA Aviso do ex', conteudo: 'x', categoria: 'COMUNICADO', autor: 'QA Zelador', fixado: false })).error, `${T} ex-Zelador NÃO publica aviso`);
  ok(!!(await cZ.from('audit_logs').insert({ usuario_id: idZ, usuario_nome: 'QA Zelador', usuario_role: 'ZELADOR', acao: 'QA ex tenta', modulo: 'RESERVAS' })).error, `${T} ex-Zelador NÃO grava no histórico`);
  const refresh = await cZ.auth.refreshSession();
  ok(!!refresh.error, `${T} a sessão do ex-Zelador não renova (sessões encerradas) → ${refresh.error?.message ?? ''}`);
  const relogin = await anon().auth.signInWithPassword({ email: email('zelador'), password: SENHA });
  ok(!!relogin.error && (relogin.error.code === 'user_banned' || /banned/i.test(relogin.error.message)), `${T} ex-Zelador NÃO entra de novo (ban no Auth) → ${relogin.error?.code ?? relogin.error?.message}`);
  ok(!!(await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ckAdm, body: { userId: idZ } })).status && (await api('/api/usuarios/resetar-senha', { method: 'POST', cookie: ckAdm, body: { userId: idZ } })).status === 409, `${T} não se gera link de senha para conta com acesso removido`);
  const cZ2 = await clientDe(email('zelador2'));
  ok((await cZ2.from('reservations').select('id')).data.length > 0 && (await cZ2.from('profiles').select('id')).data.length === 1, `${T} o novo Zelador já opera (lê reservas) sem sair e entrar`);

  // ── 6) Reativar o acesso de um ex-Zelador ──
  console.log('-- reativar o acesso de um ex-Zelador');
  const rea = (cookie, id) => api('/api/usuarios/reativar-zelador', { method: 'POST', cookie, body: { userId: id } });
  ok((await rea(ckSub, idZ)).status === 403 && (await rea(ckZ2, idZ)).status === 403 && (await rea(ckCons, idZ)).status === 403, `${T} Subsíndico, Zelador e Conselho NÃO reativam acesso`);
  const oc = await rea(ckAdm, idZ);
  ok(oc.status === 409 && oc.data.codigo === 'cargo_ocupado', `${T} com o cargo ocupado a reativação é recusada → ${oc.status}`);
  const naoDes = await rea(ckAdm, idZ2);
  ok(naoDes.status === 409 && naoDes.data.codigo === 'nao_desativado', `${T} só se reativa conta de ex-Zelador com acesso removido`);
  const naoZ = await rea(ckAdm, idM1);
  ok(naoZ.status === 409, `${T} conta que nunca foi Zelador NÃO é reativada por aqui`);
  await admin.from('profiles').update({ desativado_em: new Date().toISOString() }).eq('id', idZ2); // simula o cargo vago
  const reat = await rea(ckSind, idZ);
  ok(reat.status === 200 && reat.data.success === true, `${T} com o cargo vago o Síndico reativa o acesso do ex-Zelador (${reat.status})`);
  ok((await admin.from('profiles').select('desativado_em').eq('id', idZ).single()).data.desativado_em === null, `${T} a conta volta a ficar ativa`);
  ok((await admin.from('audit_logs').select('id').like('acao', 'Reativou o acesso de QA Zelador%')).data.length === 1, `${T} a reativação fica na auditoria`);
  const volta2 = await anon().auth.signInWithPassword({ email: email('zelador'), password: SENHA });
  ok(!volta2.error, `${T} o ex-Zelador reativado entra de novo (ban removido) ${volta2.error?.message ?? ''}`);
  const cBack = anon();
  await cBack.auth.signInWithPassword({ email: email('zelador'), password: SENHA });
  ok((await cBack.from('profiles').select('role')).data?.[0]?.role === 'ZELADOR' && (await cBack.from('reservations').select('id')).data?.length > 0, `${T} e tem o papel de Zelador de volta (lê perfil e reservas)`);
  // O segundo ativo agora é impossível de novo.
  ok((await rea(ckAdm, idZ2)).status === 409, `${T} com o cargo ocupado outra vez, nada mais é reativado`);

  // Limpeza do que esta fase criou fora do padrão @qa (o seed volta no fim da bateria).
  for (const z of zSeedGuardado) await admin.from('profiles').update({ desativado_em: null }).eq('id', z.id);
  await admin.from('fines').delete().eq('numero_protocolo', 'QA-Z1');
  await admin.from('unit_documentos').delete().eq('unit_id', U['101']);
  await admin.from('notices').delete().like('titulo', 'QA%');
  await admin.from('documents').delete().like('titulo', 'QA%');
  await admin.from('notifications').delete().like('titulo', 'QA%');
  await admin.from('notifications').delete().eq('titulo', 'Acesso do Zelador removido');
  await admin.from('notifications').delete().not('usuario_id_alvo', 'is', null);
}

const UUID0 = '00000000-0000-4000-8000-000000000001';
async function criarUsuarioSemPerfil(mail) {
  const { data, error } = await admin.auth.admin.createUser({ email: mail, password: SENHA, email_confirm: true });
  if (error) throw new Error(`createUser ${mail}: ${error.message}`);
  return data.user.id;
}
