// Bateria completa: fluxos por perfil + segurança. QA_ALVO=staging|producao.
import { admin, anon, api, cookieDe, clientDe, criarUsuario, ok, resumo, limparQA, DOMINIO, SENHA, SITE, URL_SB, ANON } from './lib.mjs';

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
const equipe = [['sindico', 'QA Síndico', 'SINDICO'], ['subsindico', 'QA Subsíndico', 'SUBSINDICO'], ['portaria', 'QA Portaria', 'PORTARIA'], ['conselho', 'QA Conselho', 'CONSELHO']]
  .filter(([, , r]) => !existentes.some((e) => e.role === r));
const { data: fila, error: filaErr } = await cAdm.from('pending_invites').insert(equipe.map(([n, nome, role]) => ({ nome, email: email(n), role, status: 'PENDENTE' }))).select();
ok(!filaErr, `ADM coloca ${equipe.length} convites na fila`);
const env1 = await api('/api/convites/enviar', { method: 'POST', cookie: ckAdm, body: { ids: fila.map((f) => f.id) } });
ok(env1.status === 200 && env1.data.results.every((r) => r.ok), `links gerados: ${env1.data?.results?.filter((r) => r.ok).length}/${fila.length}`);
for (const r of env1.data.results.filter((x) => x.ok)) {
  const loc = (await fetch(r.link, { redirect: 'manual' })).headers.get('location') ?? '';
  const hash = new URLSearchParams(loc.split('#')[1] ?? '');
  const c = anon();
  const s = await c.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') });
  const u = s.error ? s : await c.auth.updateUser({ password: SENHA });
  ok(!u.error, `${fila.find((f) => f.id === r.id).role.padEnd(10)} define senha pelo link (destino: ${loc.split('#')[0]})`);
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

await limparQA();
resumo();
