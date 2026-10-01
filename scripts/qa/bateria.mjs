// Bateria completa: fluxos por perfil + segurança. QA_ALVO=staging|producao.
import { formatarData, formatarMoeda, formatarHorario, formatarIntervalo, pluralizar } from '../../src/lib/formatadores.ts';
import { descreverAuditoria } from '../../src/lib/auditoria.ts';
import { avaliarVinculo } from '../../src/lib/vinculoUnidade.ts';
import { admin, anon, api, cookieDe, clientDe, criarUsuario, ok, resumo, limparQA, DOMINIO, SENHA, ALVO } from './lib.mjs';

const email = (n) => `${n}@${DOMINIO}`;
const hoje = new Date().toISOString().slice(0, 10);
const daqui = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const IP = () => ({ 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250) + 1}` });
await limparQA();

console.log('## Cabeçalhos de segurança');
const h = (await api('/login')).headers;
ok(/frame-ancestors 'none'/.test(h.get('content-security-policy') ?? ''), 'CSP com frame-ancestors none');
ok(h.get('x-frame-options') === 'DENY', 'X-Frame-Options DENY');
ok(h.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options nosniff');
ok(!!h.get('referrer-policy'), 'Referrer-Policy');
ok(!h.get('x-powered-by'), 'sem X-Powered-By');

console.log('\n## Callback só redireciona para dentro do portal (validação unitária da regra)');
const destinoSeguro = (next) => (!next || !/^\/[^/\\]/.test(next) && next !== '/') ? '/' : next;
for (const [n, esperado] of [['@evil.example', '/'], ['//evil.example', '/'], ['/\\evil.example', '/'], ['https://evil.example', '/'], ['/multas/1', '/multas/1'], ['/', '/']]) {
  ok(destinoSeguro(n) === esperado, `next=${n} → ${destinoSeguro(n)}`);
}

console.log('\n## A/B. Equipe por convite');
await criarUsuario(email('adm'), { name: 'QA Administradora', role: 'ADM' });
const cAdm = await clientDe(email('adm')); const ckAdm = await cookieDe(email('adm'));
// Staging já tem Síndico/Subsíndico do seed; em produção a fila convida todos.
const { data: existentes } = await admin.from('profiles').select('role').in('role', ['SINDICO', 'SUBSINDICO']);
if (ALVO === 'producao' && existentes.length) {
  // Em produção, Síndico/Subsíndico existentes são pessoas reais: nunca reaproveitar.
  console.error('Abortado: produção já tem Síndico/Subsíndico reais. A bateria só roda em produção antes do lançamento.');
  await limparQA();
  process.exit(1);
}
const equipe = [['sindico', 'QA Síndico', 'SINDICO'], ['subsindico', 'QA Subsíndico', 'SUBSINDICO'], ['portaria', 'QA Portaria', 'PORTARIA'], ['conselho', 'QA Conselho', 'CONSELHO']]
  .filter(([, , r]) => !existentes.some((e) => e.role === r));
const { data: fila, error: filaErr } = await cAdm.from('pending_invites').insert(equipe.map(([n, nome, role]) => ({ nome, email: email(n), role, status: 'PENDENTE' }))).select();
ok(!filaErr, `ADM coloca ${equipe.length} convites na fila`);
const env1 = await api('/api/convites/enviar', { method: 'POST', cookie: ckAdm, body: { ids: fila.map((f) => f.id) } });
ok(env1.status === 200 && env1.data.results.every((r) => r.ok), `links gerados: ${env1.data?.results?.filter((r) => r.ok).length}/${fila.length}`);
for (const r of env1.data.results.filter((x) => x.ok)) {
  const role = fila.find((f) => f.id === r.id).role.padEnd(10);
  const url = new URL(r.link);
  ok(url.pathname === '/definir-senha' && url.searchParams.has('token_hash'), `${role} link aponta para a página do app (não para o link de uso único do Supabase)`);
  // Robôs de pré-visualização (WhatsApp, e-mail) abrem o link antes da pessoa: não podem gastar o token.
  for (let i = 0; i < 2; i++) await fetch(r.link, { headers: { 'user-agent': 'WhatsApp/2.23.20 A' } });
  // A pessoa toca em "Continuar" (verifyOtp no navegador) e define a senha.
  const c = anon();
  const v = await c.auth.verifyOtp({ token_hash: url.searchParams.get('token_hash'), type: url.searchParams.get('type') });
  const u = v.error ? v : await c.auth.updateUser({ password: SENHA });
  ok(!u.error, `${role} define senha pelo link, mesmo depois de 2 robôs abrirem o link ${u.error?.message ?? ''}`);
  const reuso = await anon().auth.verifyOtp({ token_hash: url.searchParams.get('token_hash'), type: url.searchParams.get('type') });
  ok(!!reuso.error, `${role} o mesmo link não vale uma segunda vez`);
}
// Em staging, usa os Síndico/Subsíndico do seed trocando só a senha para a de QA.
for (const [n, role] of [['sindico', 'SINDICO'], ['subsindico', 'SUBSINDICO']]) {
  if (existentes.some((e) => e.role === role)) {
    const { data: p } = await admin.from('profiles').select('id').eq('role', role).single();
    await admin.auth.admin.updateUserById(p.id, { email: email(n), password: SENHA, email_confirm: true });
    await admin.from('profiles').update({ email: email(n) }).eq('id', p.id);
  }
}
const cSind = await clientDe(email('sindico')), cSub = await clientDe(email('subsindico'));
const cPort = await clientDe(email('portaria')), cCons = await clientDe(email('conselho'));
const ckSind = await cookieDe(email('sindico')), ckSub = await cookieDe(email('subsindico'));
const ckPort = await cookieDe(email('portaria')), ckCons = await cookieDe(email('conselho'));

console.log('\n## C/D. Unidades e cadastro público');
const { data: uni } = await cSind.from('units').insert(['101', '102', '103', '104'].map((n) => ({ bloco: 'Q', numero: n, proprietario_nome: '', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'DESOCUPADO', moradores: [], vagas_garagem: [], animais: '' }))).select();
ok(uni?.length === 4, 'Síndico cria Q-101..104');
const U = Object.fromEntries(uni.map((u) => [u.numero, u.id]));
const envio = (n, unitId, tipo, extra = {}) => ({ unitId, tipo, nome: `QA ${n}`, telefone: '(11) 90000-0000', email: email(n), senha: SENHA, consentimento: true, dependentes: [], veiculos: [], ...extra });
const rs = [];
rs.push(await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: envio('morador1', U['101'], 'PROPRIETARIO', { veiculos: [{ placa: 'qaa1b23', marca: 'Fiat', modelo: 'Uno', cor: 'Branco' }] }) }));
rs.push(await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: envio('morador2', U['102'], 'INQUILINO') }));
rs.push(await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: envio('morador3', U['103'], 'PROPRIETARIO') }));
ok(rs.every((r) => r.status === 200), `3 envios aceitos (${rs.map((r) => r.status).join('/')})`);
const fraca = await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: { ...envio('fraca', U['104'], 'PROPRIETARIO'), senha: '123456' } });
ok(fraca.status === 400, `senha de 6 caracteres recusada → ${fraca.status} "${fraca.data?.error}"`);
const dupMail = await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: envio('morador1', U['104'], 'PROPRIETARIO') });
ok(dupMail.status === 409 && !/Já existe/.test(dupMail.data?.error), `e-mail repetido → ${dupMail.status}, mensagem neutra`);

console.log('\n## E/F. Provisório e validação');
const cM1p = await clientDe(email('morador1'));
ok(!(await cM1p.from('units').select('id')).data.length && !(await cM1p.from('fines').select('id')).data.length, 'provisório isolado');
ok((await cM1p.rpc('diretorio_unidades')).data?.length > 0, 'provisório (tem perfil) vê a lista de unidades');
ok((await cM1p.from('notices').select('id')).error === null, 'provisório lê o mural');
const provNotif = await cM1p.from('notifications').insert({ titulo: 'QA prov', mensagem: 'x', tipo: 'GERAL', perfil_alvo: 'SINDICO' });
ok(!!provNotif.error, 'provisório não cria notificação');
const { data: envios } = await cAdm.from('autocadastros').select('id,email').like('email', `%@${DOMINIO}`);
const idEnv = (n) => envios.find((e) => e.email === email(n)).id;
ok((await api('/api/autocadastro/decidir', { method: 'POST', cookie: ckSub, body: { ids: [idEnv('morador1'), idEnv('morador2')], acao: 'VALIDAR' } })).status === 200, 'Subsíndico valida 2 em lote');
ok((await api('/api/autocadastro/decidir', { method: 'POST', cookie: ckAdm, body: { ids: [idEnv('morador3')], acao: 'RECUSAR', motivo: 'QA' } })).status === 200, 'ADM recusa 1');
const { data: valNot } = await admin.from('notifications').select('unidade_id_alvo').eq('titulo', 'Cadastro validado!').eq('unidade_id_alvo', U['101']);
ok(valNot.length === 1, 'notificação "Cadastro validado!" vai pela FK da unidade');
await admin.from('notifications').update({ titulo: 'QA Cadastro validado!' }).eq('titulo', 'Cadastro validado!').in('unidade_id_alvo', [U['101'], U['102']]);

console.log('\n## G/H. Multa, ciência e recurso');
const cM1 = await clientDe(email('morador1')), cM2 = await clientDe(email('morador2'));
const { data: esp } = await cSind.from('spaces').insert({ nome: 'QA Churrasqueira', descricao: 'QA', capacidade_max: 20, horario_funcionamento: '10h-22h', taxa_limpeza: 50, regras: [], ativo: true }).select().single();
ok(!(await cSind.from('notices').insert({ titulo: 'QA <img src=x onerror=alert(1)>', conteudo: 'QA', categoria: 'COMUNICADO', autor: 'QA Síndico' })).error, 'Síndico publica aviso');
ok(!(await cSub.from('documents').insert({ titulo: 'QA Regimento', descricao: 'QA', categoria: 'REGIMENTO', link_externo: 'https://example.com' })).error, 'Subsíndico publica documento');
const { data: multa } = await cSind.from('fines').insert({ numero_protocolo: 'QA-001', bloco: 'Q', unidade: '101', unit_id: U['101'], morador_nome: 'QA morador1', data_infracao: hoje, prazo_recurso_data: daqui(10), artigo_regimento: 'Art. 1', descricao_infracao: 'QA', valor: 150, tipo: 'MULTA' }).select().single();
ok(!!multa, 'Síndico emite multa');
ok(!(await cSind.from('notifications').insert({ titulo: 'QA Multa Q-101', mensagem: 'QA', tipo: 'MULTA', unidade_alvo: '101', unidade_id_alvo: U['101'], link_destino: `/multas/${multa.id}` })).error, 'Síndico notifica a unidade (texto + FK, como o app faz)');
await cM1.from('fines').update({ valor: 0, status: 'CONCLUIDA' }).eq('id', multa.id);
ok((await admin.from('fines').select('valor').eq('id', multa.id).single()).data.valor == 150, 'morador não altera valor');
ok(!(await cM1.from('fines').update({ status: 'CIENCIA_REGISTRADA', ciencia_data: new Date().toISOString(), ciencia_usuario_nome: 'QA morador1' }).eq('id', multa.id)).error, 'morador registra ciência');
ok(!(await cM1.from('fines').update({ status: 'EM_RECURSO', recurso_texto: 'QA', recurso_data: new Date().toISOString(), recurso_status: 'EM_ANALISE' }).eq('id', multa.id)).error, 'morador abre recurso');
ok(!(await cM1.from('notifications').insert({ titulo: 'QA Novo recurso', mensagem: 'QA', tipo: 'MULTA', perfil_alvo: 'SINDICO', link_destino: `/multas/${multa.id}` })).error, 'morador avisa o Síndico do recurso (fluxo do app)');
ok(!(await cSind.from('fines').update({ status: 'RECURSO_INDEFERIDO', recurso_status: 'INDEFERIDO', recurso_resposta: 'QA' }).eq('id', multa.id)).error, 'Síndico julga recurso');

console.log('\n## I. Reservas (correções 2 e 4)');
const reserva = (c, bloco, un, nome, status = 'PENDENTE', d = 7) => c.from('reservations').insert({ espaco_id: esp.id, espaco_nome: esp.nome, bloco, unidade: un, morador_nome: nome, data: daqui(d), horario_inicio: '12:00', horario_fim: '16:00', convidados_estimados: 5, status });
ok(!(await reserva(cM1, 'Q', '101', 'QA morador1')).error, 'morador1 reserva para a própria unidade');
ok(!(await cM1.from('notifications').insert({ titulo: 'QA Nova reserva', mensagem: 'QA', tipo: 'RESERVA', perfil_alvo: 'SINDICO', link_destino: '/reservas' })).error, 'morador avisa o Síndico do pedido (fluxo do app)');
await reserva(cM2, 'Q', '101', 'QA forjada', 'PENDENTE', 8);
ok(!(await admin.from('reservations').select('id').eq('morador_nome', 'QA forjada')).data.length, 'morador2 NÃO reserva em nome da Q-101');
await reserva(cM2, 'Q', '102', 'QA autoaprovada', 'APROVADA', 9);
ok(!(await admin.from('reservations').select('id').eq('morador_nome', 'QA autoaprovada')).data.length, 'morador NÃO cria reserva já aprovada');
ok(!(await reserva(cPort, 'Q', '102', 'QA via portaria', 'PENDENTE', 10)).error, 'Portaria registra pedido em nome de morador');
await reserva(cPort, 'Q', '102', 'QA portaria aprovada', 'APROVADA', 11);
ok(!(await admin.from('reservations').select('id').eq('morador_nome', 'QA portaria aprovada')).data.length, 'Portaria NÃO cria reserva já aprovada');
ok(!(await reserva(cCons, 'Q', '102', 'QA via conselho', 'PENDENTE', 12)).error, 'Conselho registra pedido em nome de morador');
ok(!(await reserva(cSind, 'Q', '102', 'QA síndico aprovada', 'APROVADA', 13)).error, 'Síndico cria reserva já aprovada');
const { data: rv1 } = await admin.from('reservations').select('id').eq('morador_nome', 'QA morador1').single();
ok(!(await cPort.from('reservations').update({ status: 'APROVADA' }).eq('id', rv1.id).select()).data?.length, 'Portaria não aprova (só Síndico/Subsíndico/ADM)');
ok((await cSub.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA Subsíndico' }).eq('id', rv1.id).select()).data?.length === 1, 'Subsíndico aprova');

console.log('\n## J. Veículos (correção 3)');
ok(!(await cM2.from('vehicles').insert({ placa: 'QAM2A22', marca: 'VW', modelo: 'Gol', cor: 'Preto', bloco: 'Q', unidade: '102', vaga: 'Q102', proprietario_nome: 'QA morador2', telefone_contato: '0', unit_id: U['102'] })).error, 'morador2 cadastra o próprio carro');
await cM2.from('vehicles').insert({ placa: 'QAX9X99', marca: 'X', modelo: 'X', cor: 'X', bloco: 'Q', unidade: '101', vaga: 'x', proprietario_nome: 'x', telefone_contato: '0', unit_id: U['101'] });
ok(!(await admin.from('vehicles').select('id').eq('placa', 'QAX9X99')).data.length, 'morador2 NÃO cadastra carro na Q-101');
await cM2.from('vehicles').insert({ placa: 'QAX9X98', marca: 'X', modelo: 'X', cor: 'X', bloco: 'Q', unidade: '102', vaga: 'x', proprietario_nome: 'x', telefone_contato: '0' });
ok(!(await admin.from('vehicles').select('id').eq('placa', 'QAX9X98')).data.length, 'morador NÃO cadastra carro sem unidade');
ok(!(await cPort.from('vehicles').insert({ placa: 'QAV0S01', marca: 'V', modelo: 'QA', cor: 'Azul', bloco: 'Q', unidade: '102', vaga: 'Visitante', proprietario_nome: 'QA Visita', telefone_contato: '0', status: 'VISITANTE', unit_id: U['102'] })).error, 'Portaria registra visitante');

console.log('\n## K. Outro bloco com o mesmo número (correção 4)');
const { data: r101 } = await admin.from('units').insert({ bloco: 'R', numero: '101', proprietario_nome: 'QA R101', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'PROPRIETARIO', moradores: [] }).select().single();
const idR = await criarUsuario(email('moradorR'), { name: 'QA moradorR', role: 'MORADOR', bloco: 'R', unidade: '101' });
await admin.from('units').update({ usuario_id: idR, status_convite: 'ATIVO' }).eq('id', r101.id);
await admin.from('notifications').insert({ titulo: 'QA legado Q-101', mensagem: 'QA', tipo: 'RESERVA', unidade_alvo: '101' });
const cR = await clientDe(email('moradorR'));
ok(!(await cR.from('reservations').select('bloco')).data.some((r) => r.bloco === 'Q'), 'R-101 NÃO vê reservas da Q-101');
const notR = (await cR.from('notifications').select('titulo')).data.map((n) => n.titulo);
ok(!notR.includes('QA Multa Q-101') && !notR.includes('QA legado Q-101'), `R-101 NÃO vê notificações da Q-101 (${notR.filter((t) => t.startsWith('QA')).join(', ') || 'nenhuma'})`);
const notM1 = (await cM1.from('notifications').select('titulo')).data.map((n) => n.titulo);
ok(notM1.includes('QA Multa Q-101'), 'Q-101 recebe a própria notificação de multa');

console.log('\n## Notificações: link externo e criação indevida (correção 5)');
ok(!!(await cSind.from('notifications').insert({ titulo: 'QA externo', mensagem: 'x', tipo: 'GERAL', link_destino: 'https://evil.example' })).error, 'link externo recusado (até para admin)');
ok(!!(await cSind.from('notifications').insert({ titulo: 'QA externo2', mensagem: 'x', tipo: 'GERAL', link_destino: '//evil.example' })).error, 'link "//site" recusado');
ok(!!(await cM2.from('notifications').insert({ titulo: 'QA geral por morador', mensagem: 'x', tipo: 'GERAL' })).error, 'morador NÃO cria notificação para todos');
ok(!!(await cM2.from('notifications').insert({ titulo: 'QA para unidade', mensagem: 'x', tipo: 'GERAL', perfil_alvo: 'SINDICO', unidade_id_alvo: U['101'] })).error, 'morador NÃO notifica outra unidade');
ok(!!(await cPort.from('notifications').insert({ titulo: 'QA portaria geral', mensagem: 'x', tipo: 'GERAL' })).error, 'Portaria NÃO cria notificação para todos');

console.log('\n## "Lida" por usuário (correção 10)');
const { data: geral } = await cSind.from('notifications').insert({ titulo: 'QA Geral', mensagem: 'QA', tipo: 'GERAL' }).select().single();
ok(!(await cM2.from('notification_reads').insert({ notification_id: geral.id })).error, 'morador2 marca como lida');
const lidaPara = async (c) => ((await c.from('notifications').select('id, notification_reads(user_id)').eq('id', geral.id).single()).data?.notification_reads ?? []).length > 0;
ok(await lidaPara(cM2), 'fica lida para o morador2');
ok(!(await lidaPara(cM1)), 'continua NÃO lida para o morador1');
ok(!(await lidaPara(cSind)), 'continua NÃO lida para o Síndico');
ok(!!(await cM2.from('notifications').update({ lida: true }).eq('id', geral.id)).error, 'campo antigo "lida" não é mais editável');

console.log('\n## Histórico de ações (correção 6)');
const { data: pM2 } = await admin.from('profiles').select('id,name,role').eq('email', email('morador2')).single();
ok(!!(await cM2.from('audit_logs').insert({ usuario_id: pM2.id, usuario_nome: 'QA Síndico', usuario_role: 'SINDICO', acao: 'QA forjado', modulo: 'SISTEMA' })).error, 'morador NÃO grava registro se passando pelo Síndico');
const { data: pS } = await admin.from('profiles').select('id,name,role').eq('email', email('sindico')).single();
ok(!(await cSind.from('audit_logs').insert({ usuario_id: pS.id, usuario_nome: pS.name, usuario_role: pS.role, acao: 'QA legítimo', modulo: 'SISTEMA' })).error, 'Síndico grava registro em nome próprio');

console.log('\n## Conta criada direto na API do Supabase, sem perfil (correção 1)');
await criarUsuario(email('intruso-api'));
const cX = await clientDe(email('intruso-api'));
const vazados = [];
for (const t of ['profiles', 'units', 'vehicles', 'fines', 'spaces', 'reservations', 'documents', 'notices', 'notifications', 'audit_logs', 'pending_invites', 'autocadastros', 'autocadastro_config', 'zelador', 'portal_administradora', 'notification_reads']) {
  const r = await cX.from(t).select('*');
  if (!r.error && r.data.length) vazados.push(`${t}(${r.data.length})`);
}
ok(vazados.length === 0, `sem perfil não lê nenhuma tabela ${vazados.join(' ')}`);
ok(!(await cX.rpc('diretorio_unidades')).data?.length, 'sem perfil NÃO vê a lista de moradores');
await reserva(cX, 'Q', '102', 'QA intruso', 'PENDENTE', 14);
ok(!(await admin.from('reservations').select('id').eq('morador_nome', 'QA intruso')).data.length, 'sem perfil NÃO cria reserva');
ok(!!(await cX.from('notifications').insert({ titulo: 'QA intruso', mensagem: 'x', tipo: 'GERAL', perfil_alvo: 'SINDICO' })).error, 'sem perfil NÃO cria notificação');
ok(!!(await cX.from('audit_logs').insert({ usuario_id: (await cX.auth.getUser()).data.user.id, usuario_nome: 'x', usuario_role: 'x', acao: 'QA', modulo: 'SISTEMA' })).error, 'sem perfil NÃO grava histórico');
const ckX = await cookieDe(email('intruso-api'));
ok((await api('/api/autocadastro/decidir', { method: 'POST', cookie: ckX, body: { ids: [], acao: 'VALIDAR' } })).status === 403, 'sem perfil barrado nas rotas administrativas');

console.log('\n## L. Vincular unidade a conta que já existe (e-mail repetido)');
// Usa a regra real (src/lib/vinculoUnidade.ts) com os dados do banco e repete, com o
// cliente de cada perfil, as gravações que o app faz ao vincular (units, pending_invites,
// audit_logs): assim as regras de acesso (RLS) são testadas de verdade.
const carregar = async () => {
  const { data: ps } = await admin.from('profiles').select('*');
  const { data: us } = await admin.from('units').select('*');
  return {
    contas: ps.map((p) => ({ id: p.id, name: p.name, email: p.email ?? '', role: p.role, bloco: p.bloco ?? undefined, unidade: p.unidade ?? undefined, cadastroValidado: p.cadastro_validado ?? true })),
    unidades: us.map((u) => ({ id: u.id, bloco: u.bloco, numero: u.numero, usuarioId: u.usuario_id ?? undefined, moradores: u.moradores ?? [] })),
  };
};
const novaUnidade = async (num, extra = {}) => (await admin.from('units').insert({ bloco: 'Q', numero: num, proprietario_nome: 'QA titular', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'PROPRIETARIO', moradores: [], vagas_garagem: [], animais: '', ...extra }).select().single()).data;
const convitesDa = async (unitId) => (await admin.from('pending_invites').select('id,status').eq('unit_id', unitId)).data ?? [];
const gravarVinculo = async (c, unit, conta, ator) => {
  const up = await c.from('units').update({ usuario_id: conta.id, status_convite: 'ATIVO' }).eq('id', unit.id).select();
  if (!up.data?.length) return false;
  const velhos = (await c.from('pending_invites').select('id,status').eq('unit_id', unit.id)).data ?? [];
  for (const i of velhos.filter((x) => x.status === 'PENDENTE' || x.status === 'ERRO')) await c.from('pending_invites').delete().eq('id', i.id);
  await c.from('audit_logs').insert({ usuario_id: ator.id, usuario_nome: ator.name, usuario_role: ator.role, acao: `Vinculou a Unidade ${unit.bloco}-${unit.numero} à conta de ${conta.name}`, modulo: 'UNIDADES' });
  return true;
};
const idsPerfis = Object.fromEntries((await admin.from('profiles').select('id,name,email,role')).data.filter((p) => p.email?.endsWith('@' + DOMINIO)).map((p) => [p.email.split('@')[0], p]));
const unidadeSemVinculo = async (id) => { const { data } = await admin.from('units').select('usuario_id,status_convite').eq('id', id).single(); return data.usuario_id === null && data.status_convite !== 'ATIVO'; };

// Item 1 e 3: e-mail sem conta segue o fluxo de convite; e-mail com espaços e maiúsculas é reconhecido.
let { contas, unidades } = await carregar();
ok(avaliarVinculo('ninguem@exemplo.test', {}, contas, unidades).tipo === 'SEM_CONTA', 'e-mail sem conta → segue o convite de sempre');
ok(avaliarVinculo('   ', {}, contas, unidades).tipo === 'SEM_CONTA', 'e-mail em branco → segue o fluxo normal');
const avEspaco = avaliarVinculo(`  ${email('sindico').toUpperCase().replace('QA.HARMONY.TEST', 'Qa.Harmony.Test')} `, {}, contas, unidades);
ok(avEspaco.tipo === 'VINCULAR' && avEspaco.conta.id === idsPerfis.sindico.id, 'e-mail com espaços e maiúsculas é reconhecido como o da conta');

// Itens 2, 7 e 8: Síndico, Subsíndico e ADM vinculam; convite com erro/pendente some; há auditoria.
for (const [n, c, ator, num, statusConvite] of [['sindico', cSind, 'sindico', '201', 'ERRO'], ['subsindico', cSub, 'subsindico', '202', 'PENDENTE'], ['adm', cAdm, 'adm', '203', 'ERRO']]) {
  const u = await novaUnidade(num, { moradores: [{ nome: 'QA titular', tipo: 'TITULAR', telefone: '', email: email(n) }], status_convite: 'PENDENTE' });
  await admin.from('pending_invites').insert({ nome: 'QA titular', email: email(n), role: 'MORADOR', bloco: 'Q', unidade: num, unit_id: u.id, status: statusConvite, erro_mensagem: statusConvite === 'ERRO' ? 'already been registered' : null });
  ({ contas, unidades } = await carregar());
  const av = avaliarVinculo(email(n), { id: u.id }, contas, unidades);
  ok(av.tipo === 'VINCULAR' && av.conta.id === idsPerfis[n].id, `${n}: e-mail com conta → pede confirmação (nome ${av.conta?.name}, perfil ${av.conta?.role})`);
  ok(await gravarVinculo(c, u, av.conta, idsPerfis[ator]), `${n}: vincula a Q-${num}`);
  const { data: depois } = await admin.from('units').select('usuario_id,status_convite').eq('id', u.id).single();
  ok(depois.usuario_id === idsPerfis[n].id && depois.status_convite === 'ATIVO', `${n}: usuario_id e status ATIVO gravados`);
  ok((await convitesDa(u.id)).length === 0, `${n}: convite ${statusConvite} da unidade foi removido (zero convites)`);
  const { data: aud } = await admin.from('audit_logs').select('acao,modulo').eq('acao', `Vinculou a Unidade Q-${num} à conta de ${idsPerfis[n].name}`);
  ok(aud?.length === 1 && aud[0].modulo === 'UNIDADES', `${n}: auditoria "Vinculou a Unidade Q-${num} à conta de ${idsPerfis[n].name}"`);
}
// A mesma conta de equipe pode ter outra unidade (síndico com 2 apartamentos).
{
  const u = await novaUnidade('204');
  ({ contas, unidades } = await carregar());
  ok(avaliarVinculo(email('sindico'), { id: u.id }, contas, unidades).tipo === 'VINCULAR', 'conta de equipe já ligada a outra unidade pode receber mais uma');
}

// Item 4: Morador sem nenhuma unidade vincula igual.
{
  const idSem = await criarUsuario(email('moradorsem'), { name: 'QA Morador Sem Unidade', role: 'MORADOR' });
  const u = await novaUnidade('205');
  await admin.from('pending_invites').insert({ nome: 'QA x', email: email('moradorsem'), role: 'MORADOR', bloco: 'Q', unidade: '205', unit_id: u.id, status: 'ERRO' });
  ({ contas, unidades } = await carregar());
  const av = avaliarVinculo(email('moradorsem'), { id: u.id }, contas, unidades);
  ok(av.tipo === 'VINCULAR' && av.conta.id === idSem, 'Morador sem unidade → pode vincular');
  ok(await gravarVinculo(cSind, u, av.conta, idsPerfis.sindico), 'Síndico vincula Q-205 ao Morador sem unidade');
  const { data: dep } = await admin.from('units').select('usuario_id,status_convite').eq('id', u.id).single();
  ok(dep.usuario_id === idSem && dep.status_convite === 'ATIVO' && (await convitesDa(u.id)).length === 0, 'Morador sem unidade: vínculo ATIVO e zero convites');
}

// Item 5: casos bloqueados não criam unidade, convite nem vínculo.
{
  await criarUsuario(email('moradorprov'), { name: 'QA Morador Provisório', role: 'MORADOR', cadastro_validado: false });
  const u = await novaUnidade('206');
  ({ contas, unidades } = await carregar());
  const antesUnidades = unidades.length;
  const comUnidade = avaliarVinculo(email('morador1'), { id: u.id }, contas, unidades);
  ok(comUnidade.tipo === 'BLOQUEADO' && /já está ligada à unidade Q-101/.test(comUnidade.mensagem) && /mais de uma unidade/.test(comUnidade.mensagem), `Morador com unidade → bloqueado: "${comUnidade.mensagem}"`);
  const prov = avaliarVinculo(email('moradorprov'), { id: u.id }, contas, unidades);
  ok(prov.tipo === 'BLOQUEADO' && /aguarda validação em Autocadastro/.test(prov.mensagem), `conta provisória → bloqueada: "${prov.mensagem}"`);
  const u201 = unidades.find((x) => x.numero === '201' && x.bloco === 'Q');
  const outra = avaliarVinculo(email('subsindico'), { id: u201.id, usuarioId: u201.usuarioId }, contas, unidades);
  ok(outra.tipo === 'BLOQUEADO' && outra.mensagem === `Esta unidade já está vinculada a ${idsPerfis.sindico.name}.`, `unidade já ligada a outra conta → bloqueada: "${outra.mensagem}"`);
  ok(avaliarVinculo(email('sindico'), { id: u201.id, usuarioId: u201.usuarioId }, contas, unidades).tipo === 'JA_VINCULADA', 'unidade já ligada à mesma conta → nada a fazer');
  ok(await unidadeSemVinculo(u.id) && (await convitesDa(u.id)).length === 0, 'nos bloqueios: unidade sem vínculo e nenhum convite criado');
  ({ unidades } = await carregar());
  ok(unidades.length === antesUnidades, 'nos bloqueios: nenhuma unidade nova foi criada');
}

// Item 9: só Síndico, Subsíndico e ADM gravam o vínculo; os demais são barrados pelo banco.
{
  const u = await novaUnidade('207', { status_convite: 'PENDENTE' });
  await admin.from('pending_invites').insert({ nome: 'QA x', email: email('sindico'), role: 'MORADOR', bloco: 'Q', unidade: '207', unit_id: u.id, status: 'ERRO' });
  for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons], ['Morador', cM1], ['Morador provisório', await clientDe(email('moradorprov'))]]) {
    const r = await c.from('units').update({ usuario_id: idsPerfis.sindico.id, status_convite: 'ATIVO' }).eq('id', u.id).select();
    await c.from('pending_invites').delete().eq('unit_id', u.id);
    ok(!r.data?.length && await unidadeSemVinculo(u.id) && (await convitesDa(u.id)).length === 1, `${nome}: NÃO vincula nem apaga o convite (barrado pelo banco)`);
  }
}

console.log('\n## Rotas administrativas por quem não é admin');
const ckM1 = await cookieDe(email('morador1'));
for (const [nome, ck] of [['Morador', ckM1], ['Portaria', ckPort], ['Conselho', ckCons]]) {
  const st = [];
  for (const p of ['/api/autocadastro/decidir', '/api/convites/enviar', '/api/unidades/excluir', '/api/usuarios/excluir', '/api/usuarios/resetar-senha']) st.push((await api(p, { method: 'POST', cookie: ck, body: { ids: ['x'], unitId: 'x', userId: 'x', acao: 'VALIDAR' } })).status);
  ok(st.every((s) => s === 403), `${nome}: ${st.join(' ')}`);
}

console.log('\n## Visitante sem login');
const a = anon();
const abertos = [];
for (const t of ['profiles', 'units', 'spaces', 'notices', 'documents', 'notifications', 'notification_reads', 'autocadastro_config', 'zelador', 'portal_administradora']) {
  const r = await a.from(t).select('*'); if (!r.error && r.data.length) abertos.push(t);
}
ok(abertos.length === 0, `visitante não lê nada ${abertos.join(' ')}`);
for (const p of ['/', '/moradores', '/autocadastro']) { const r = await api(p); ok(r.status === 307 && r.location?.includes('/login'), `${p} sem login → login`); }

console.log('\n## Trilha de auditoria legível (src/lib/auditoria.ts) e quem grava/lê');
{
  const igual = (obtido, esperado, nome) => ok(obtido === esperado, `${nome}: ${JSON.stringify(obtido)}`);
  const rec = descreverAuditoria('Recusou reserva de Salão de Festas', { reservationId: 'd43d768d-0000', espaco: 'Salão de Festas', unidade: '102', aprovado: false, motivoRecusa: 'Data indisponível' });
  igual(rec.frase, 'Reserva de Salão de Festas, unidade 102: recusada. Motivo: Data indisponível', 'reserva recusada vira frase');
  igual(descreverAuditoria('Aprovou reserva de Churrasqueira', { espaco: 'Churrasqueira', unidade: '5', aprovado: true }).frase, 'Reserva de Churrasqueira, unidade 5: aprovada.', 'reserva aprovada vira frase');
  ok(rec.tecnicos.some((t) => t.chave === 'reservationId') && rec.detalhes.length === 0, 'id da reserva vai para "detalhes técnicos"');
  igual(descreverAuditoria('Registrou ciência da notificação', { fineId: 'c8a1cc2e-1', protocolo: 'NOT-2026/004' }).frase, 'Multa NOT-2026/004: ciência registrada.', 'ciência registrada');
  igual(descreverAuditoria('Interpôs recurso da notificação', { fineId: 'x', protocolo: 'NOT-2026/004' }).frase, 'Multa NOT-2026/004: recurso interposto.', 'recurso interposto');
  igual(descreverAuditoria('Indeferiu recurso da notificação', { fineId: 'x', protocolo: 'NOT-2026/004', deferido: false }).frase, 'Multa NOT-2026/004: recurso indeferido (multa mantida).', 'recurso indeferido');
  igual(descreverAuditoria('Deferiu recurso da notificação', { fineId: 'x', deferido: true }).frase, 'Multa: recurso deferido (multa anulada).', 'registro antigo, sem protocolo');
  igual(descreverAuditoria('Emitiu notificação/multa NOT-2026/004', { protocolo: 'NOT-2026/004', unidade: '102', bloco: 'A', valor: 0 }).frase, 'Advertência NOT-2026/004 emitida para a unidade 102, bloco A.', 'advertência não mostra valor');
  ok(/^Multa NOT-2026\/005 emitida para a unidade 7, bloco B \(R\$\s350,00\)\.$/.test(descreverAuditoria('Emitiu notificação/multa NOT-2026/005', { protocolo: 'NOT-2026/005', unidade: '7', bloco: 'B', valor: 350 }).frase), 'multa mostra o valor em reais');
  const fb = descreverAuditoria('Atualizou espaço comum: Salão', { id: 'abc-123', nome: 'Salão', taxaLimpeza: 50, unitId: 'u-1', ids: ['a', 'b'] });
  igual(fb.frase, 'Atualizou espaço comum: Salão', 'ação desconhecida mantém o texto da ação');
  igual(fb.detalhes.join(' | '), 'Nome: Salão | Taxa de limpeza: 50', 'fallback lista chave: valor sem ids');
  ok(!fb.detalhes.join(' ').includes('abc-123') && fb.tecnicos.map((t) => t.chave).sort().join() === 'id,ids,unitId', 'ids e listas ficam só nos detalhes técnicos');
  igual(descreverAuditoria('Qualquer coisa', undefined).frase, 'Qualquer coisa', 'sem detalhes não quebra');
  igual(descreverAuditoria('Qualquer coisa', { aprovado: false }).detalhes[0], 'Aprovado: Não', 'booleano em português');
}
{
  // O app grava ciência e recurso como o próprio morador (policy audit_logs_insert_proprio).
  const { data: pM1 } = await admin.from('profiles').select('id,name,role').eq('email', email('morador1')).single();
  const { data: pM2b } = await admin.from('profiles').select('id,name,role').eq('email', email('morador2')).single();
  const { data: pS2 } = await admin.from('profiles').select('id,name,role').eq('email', email('sindico')).single();
  const regs = [['Registrou ciência da notificação', { fineId: 'qa', protocolo: 'QA-001' }], ['Interpôs recurso da notificação', { fineId: 'qa', protocolo: 'QA-001' }]];
  for (const [acao, detalhes] of regs) {
    ok(!(await cM1.from('audit_logs').insert({ usuario_id: pM1.id, usuario_nome: pM1.name, usuario_role: pM1.role, acao, modulo: 'MULTAS', detalhes })).error, `morador grava o próprio registro: ${acao}`);
    ok(!!(await cM1.from('audit_logs').insert({ usuario_id: pM2b.id, usuario_nome: pM2b.name, usuario_role: pM2b.role, acao, modulo: 'MULTAS', detalhes })).error, `morador NÃO grava em nome de outro morador: ${acao}`);
    ok(!!(await cM1.from('audit_logs').insert({ usuario_id: pM1.id, usuario_nome: pS2.name, usuario_role: pS2.role, acao, modulo: 'MULTAS', detalhes })).error, `morador NÃO grava com nome/perfil do Síndico: ${acao}`);
  }
  const quemLe = async (c) => (await c.from('audit_logs').select('id').eq('acao', 'Registrou ciência da notificação')).data?.length ?? 0;
  ok((await quemLe(cSind)) >= 1, 'Síndico lê o registro de ciência');
  ok((await quemLe(cCons)) >= 1, 'Conselho lê o registro de ciência');
  ok((await quemLe(cM1)) === 0, 'Morador NÃO lê o histórico (nem o próprio registro)');
  ok((await quemLe(cPort)) === 0, 'Portaria NÃO lê o histórico');
}

console.log('\n## Formatadores de exibição (src/lib/formatadores.ts)');
{
  const igual = (obtido, esperado, nome) => ok(obtido === esperado, `${nome}: ${JSON.stringify(obtido)}`);
  igual(formatarData('2026-10-01'), '01/10/2026', 'data simples');
  igual(formatarData('2026-12-31'), '31/12/2026', 'data fim de ano (sem virar o ano)');
  igual(formatarData('2027-01-01'), '01/01/2027', 'data início de ano');
  igual(formatarData('2026-03-01'), '01/03/2026', 'virada de mês (sem recuar pelo fuso)');
  igual(formatarData('2028-02-29'), '29/02/2028', 'ano bissexto');
  igual(formatarData(''), '', 'data vazia');
  igual(formatarData(undefined), '', 'data indefinida');
  igual(formatarData('texto livre'), 'texto livre', 'texto que não é data volta como veio');
  igual(formatarData('2026-10-01T02:00:00.000Z'), new Date('2026-10-01T02:00:00.000Z').toLocaleDateString('pt-BR'), 'timestamp vira a data local');
  igual(formatarMoeda(150), 'R$ 150,00', 'moeda inteira');
  igual(formatarMoeda(150.5), 'R$ 150,50', 'moeda com 1 casa');
  igual(formatarMoeda(0.1 + 0.2), 'R$ 0,30', 'centavos de ponto flutuante');
  igual(formatarMoeda(1234.567), 'R$ 1.234,57', 'milhar e arredondamento');
  igual(formatarMoeda(0), 'R$ 0,00', 'zero');
  igual(formatarHorario('12:00:00'), '12h', 'hora cheia');
  igual(formatarHorario('12:30:00'), '12h30', 'hora e minutos');
  igual(formatarHorario('09:05'), '9h05', 'sem segundos e zero à esquerda');
  igual(formatarHorario('00:00:00'), '0h', 'meia-noite');
  igual(formatarHorario('Dia todo'), 'Dia todo', 'texto livre volta como veio');
  igual(formatarIntervalo('12:00:00', '18:00:00'), '12h às 18h', 'intervalo');
  igual(formatarIntervalo('08:30:00', '22:00:00'), '8h30 às 22h', 'intervalo com minutos');
  igual(pluralizar(0, 'recurso', 'recursos'), '0 recursos', 'plural de zero');
  igual(pluralizar(1, 'recurso', 'recursos'), '1 recurso', 'singular');
  igual(pluralizar(2, 'recurso', 'recursos'), '2 recursos', 'plural');
}

await limparQA();
resumo();
