// Bateria completa: fluxos por perfil + segurança. QA_ALVO=staging|producao.
import { formatarData, formatarMoeda, formatarHorario, formatarIntervalo, pluralizar, situacaoDoPrazo, textoDoPrazo } from '../../src/lib/formatadores.ts';
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
rs.push(await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: envio('morador1', U['101'], 'PROPRIETARIO', { veiculos: [{ placa: 'qaa1b23', marca: 'Fiat', modelo: 'Uno', cor: 'Branco', tipoVeiculo: 'MOTO' }] }) }));
rs.push(await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: envio('morador2', U['102'], 'INQUILINO') }));
rs.push(await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: envio('morador3', U['103'], 'PROPRIETARIO') }));
ok(rs.every((r) => r.status === 200), `3 envios aceitos (${rs.map((r) => r.status).join('/')})`);
const veicSemTipo = { placa: 'QAS1T01', marca: 'X', modelo: 'Y', cor: 'Z' };
for (const [nome, v, esperado] of [['sem tipo', veicSemTipo, /tipo do veículo 1/], ['tipo inválido (BICICLETA)', { ...veicSemTipo, tipoVeiculo: 'BICICLETA' }, /tipo do veículo 1/], ['tipo em minúscula', { ...veicSemTipo, tipoVeiculo: 'carro' }, /tipo do veículo 1/], ['tipo com texto livre', { ...veicSemTipo, tipoVeiculo: { outro: 'trator' } }, /tipo do veículo 1/]]) {
  const r = await api('/api/autocadastro/publico', { method: 'POST', headers: IP(), body: envio('semtipo', U['104'], 'PROPRIETARIO', { veiculos: [v] }) });
  ok(r.status === 400 && esperado.test(r.data?.error ?? ''), `autocadastro com veículo ${nome} recusado → ${r.status} "${r.data?.error}"`);
}
ok(!(await admin.from('autocadastros').select('id').eq('email', email('semtipo'))).data.length, 'nenhum envio gravado para os veículos sem tipo válido');
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

console.log('\n## J2. Tipo do veículo (issue #43)');
const tipoDe = async (placa) => (await admin.from('vehicles').select('tipo_veiculo').eq('placa', placa).single()).data?.tipo_veiculo;
const veic = (placa, extra = {}) => ({ placa, marca: 'X', modelo: 'X', cor: 'X', bloco: 'Q', unidade: '102', vaga: 'Q102', proprietario_nome: 'x', telefone_contato: '0', unit_id: U['102'], ...extra });
ok((await tipoDe('QAM2A22')) === 'OUTRO', 'veículo cadastrado sem tipo fica OUTRO (padrão do banco, igual aos veículos antigos)');
ok((await tipoDe('QAA1B23')) === 'MOTO', 'validação do autocadastro cria o veículo com o tipo informado (MOTO)');
ok(!!(await admin.from('vehicles').insert(veic('QAT0B01', { tipo_veiculo: 'BICICLETA' }))).error, 'banco recusa tipo inválido (BICICLETA) até com a chave de serviço');
ok(!!(await admin.from('vehicles').insert(veic('QAT0B02', { tipo_veiculo: 'carro' }))).error, 'banco recusa tipo em minúscula');
ok(!!(await cM2.from('vehicles').insert(veic('QAT0B03', { tipo_veiculo: 'TRATOR' }))).error, 'morador NÃO cadastra veículo com tipo inválido');
ok(!!(await cPort.from('vehicles').insert(veic('QAT0B04', { tipo_veiculo: '' }))).error, 'Portaria NÃO cadastra veículo com tipo vazio');
ok(!(await cPort.from('vehicles').insert(veic('QAT0M05', { tipo_veiculo: 'MOTO', status: 'VISITANTE' }))).error && (await tipoDe('QAT0M05')) === 'MOTO', 'Portaria cadastra visitante com tipo MOTO');
for (const [nome, c, tipo] of [['Síndico', cSind, 'MOTO'], ['Subsíndico', cSub, 'CARRO'], ['ADM', cAdm, 'MOTO']]) {
  const r = await c.from('vehicles').update({ tipo_veiculo: tipo }).eq('placa', 'QAM2A22').select('id');
  ok(r.data?.length === 1 && (await tipoDe('QAM2A22')) === tipo, `${nome} define o tipo do veículo (${tipo})`);
}
const inv = await cSind.from('vehicles').update({ tipo_veiculo: 'BICICLETA' }).eq('placa', 'QAM2A22').select('id');
ok(!!inv.error && (await tipoDe('QAM2A22')) === 'MOTO', 'Síndico NÃO grava tipo inválido pela API direta');
for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons], ['visitante (sem login)', anon()]]) {
  const r = await c.from('vehicles').update({ tipo_veiculo: 'CARRO' }).eq('placa', 'QAM2A22').select('id');
  ok(!r.data?.length && (await tipoDe('QAM2A22')) === 'MOTO', `${nome} NÃO edita o tipo do veículo`);
}
// ── Dependem da policy/gatilhos do morador (parte final da migração 0030) ──
const m2 = await cM2.from('vehicles').update({ tipo_veiculo: 'CARRO' }).eq('placa', 'QAM2A22').select('id');
ok(m2.data?.length === 1 && (await tipoDe('QAM2A22')) === 'CARRO', '[0030-morador] morador2 corrige o tipo do PRÓPRIO veículo');
const { data: logTipo } = await admin.from('audit_logs').select('acao,usuario_role,detalhes').like('acao', 'Alterou o tipo de um veículo da unidade 102 (Bloco Q)%').eq('usuario_role', 'MORADOR');
ok(logTipo?.length >= 1 && logTipo.every((l) => !/QAM2A22/.test(JSON.stringify(l))) && /de Moto para Carro$/.test(logTipo[0].acao), `[0030-morador] o banco registra a troca com frase legível e sem placa ("${logTipo?.[0]?.acao}")`);
const antes = (await admin.from('vehicles').select('*').eq('placa', 'QAM2A22').single()).data;
// Placa, marca, modelo e cor deixaram de ser recusados ao morador na migração 0031 (issue #46): ver a seção J3.
for (const [nome, mudanca] of [['vaga', { vaga: 'Q999' }], ['status', { status: 'VISITANTE' }], ['unit_id (passar para a Q-101)', { unit_id: U['101'] }], ['tipo junto com a vaga', { tipo_veiculo: 'MOTO', vaga: 'Q999' }], ['telefone', { telefone_contato: '999' }]]) {
  const r = await cM2.from('vehicles').update(mudanca).eq('placa', 'QAM2A22').select('id');
  ok(!!r.error && !r.data?.length, `[0030-morador] dono NÃO altera ${nome} (recusado)`);
}
const depois = (await admin.from('vehicles').select('*').eq('placa', 'QAM2A22').single()).data;
ok(JSON.stringify(antes) === JSON.stringify(depois), '[0030-morador] nada mudou no veículo depois das tentativas');
ok(!!(await cM2.from('vehicles').update({ tipo_veiculo: 'TRATOR' }).eq('placa', 'QAM2A22').select('id')).error, '[0030-morador] dono NÃO grava tipo inválido');
ok(!(await cM2.from('vehicles').update({ tipo_veiculo: 'MOTO' }).eq('placa', 'QAA1B23').select('id')).data?.length && (await tipoDe('QAA1B23')) === 'MOTO', '[0030-morador] morador2 NÃO edita veículo de OUTRA unidade (0 linhas)');
ok(!(await cM1.from('vehicles').update({ tipo_veiculo: 'OUTRO' }).eq('placa', 'QAM2A22').select('id')).data?.length && (await tipoDe('QAM2A22')) === 'CARRO', '[0030-morador] morador1 NÃO edita veículo da unidade 102 (0 linhas)');
// Morador com cadastro provisório continua bloqueado (policy restritiva vehicles_block_provisorio).
const idProv = await criarUsuario(email('prov'), { name: 'QA provisório', role: 'MORADOR', bloco: 'Q', unidade: '104', cadastro_validado: false });
await admin.from('units').update({ usuario_id: idProv, status_convite: 'ATIVO' }).eq('id', U['104']);
await admin.from('vehicles').insert(veic('QAP0V04', { unidade: '104', unit_id: U['104'] }));
const cProv = await clientDe(email('prov'));
const rp = await cProv.from('vehicles').update({ tipo_veiculo: 'CARRO' }).eq('placa', 'QAP0V04').select('id');
ok(!rp.data?.length && (await tipoDe('QAP0V04')) === 'OUTRO', '[0030-morador] morador provisório NÃO edita o tipo (continua bloqueado)');

console.log('\n## J3. Morador edita o veículo da própria unidade (issue #46) — itens [0031] só passam depois de aplicar a migração 0031');
// {} quando a placa não existe (ex.: a 0031 ainda não foi aplicada): a verificação falha em vez de a bateria quebrar.
const linha = async (placa) => (await admin.from('vehicles').select('*').eq('placa', placa).single()).data ?? {};
const veicId = (await linha('QAM2A22')).id;
const veicOutraId = (await linha('QAA1B23')).id;
// 1) morador da própria unidade edita os cinco campos; placa em minúsculas é normalizada
const e1 = await cM2.from('vehicles').update({ placa: 'qab3c45', marca: 'Fiat', modelo: 'Uno', cor: 'Rosa', tipo_veiculo: 'MOTO' }).eq('id', veicId).select();
const v1 = await linha('QAB3C45');
ok(e1.data?.length === 1 && v1?.id === veicId && v1.marca === 'Fiat' && v1.modelo === 'Uno' && v1.cor === 'Rosa' && v1.tipo_veiculo === 'MOTO', '[0031] morador2 edita placa, marca, modelo, cor e tipo do PRÓPRIO veículo (placa em minúsculas vira maiúscula)');
// 2) auditoria: frase sem placa, de-para nos detalhes
const { data: logEd } = await admin.from('audit_logs').select('acao,usuario_role,detalhes').like('acao', 'Alterou um veículo da unidade 102 (Bloco Q)%').eq('usuario_role', 'MORADOR');
ok(logEd?.length === 1 && logEd[0].acao === 'Alterou um veículo da unidade 102 (Bloco Q): placa, marca, modelo, cor e tipo' && !/QAM2A22|QAB3C45/.test(logEd[0].acao), `[0031] auditoria do banco com frase legível e SEM placa ("${logEd?.[0]?.acao}")`);
ok(logEd?.[0]?.detalhes?.alteracoes?.placa?.de === 'QAM2A22' && logEd[0].detalhes.alteracoes.placa.para === 'QAB3C45' && logEd[0].detalhes.alteracoes.cor?.para === 'Rosa', '[0031] auditoria guarda o de-para (placa antiga e nova) nos detalhes');
// 3) o que continua só da equipe: recusado ao morador
const antes3 = await linha('QAB3C45');
for (const [nome, mudanca] of [['vaga', { vaga: 'Q999' }], ['status', { status: 'VISITANTE' }], ['proprietário', { proprietario_nome: 'Outro Nome' }], ['telefone', { telefone_contato: '999' }], ['unidade', { unidade: '101' }], ['bloco', { bloco: 'R' }], ['unit_id', { unit_id: U['101'] }], ['id', { id: 'forjado' }], ['created_at', { created_at: '2001-01-01T00:00:00Z' }], ['cor junto com a vaga', { cor: 'Verde', vaga: 'Q999' }]]) {
  const r = await cM2.from('vehicles').update(mudanca).eq('id', veicId).select('id');
  ok(!!r.error && !r.data?.length, `[0031] dono NÃO altera ${nome} (recusado)`);
}
ok(JSON.stringify(antes3) === JSON.stringify(await linha('QAB3C45')), '[0031] nada mudou depois das tentativas recusadas');
// 4) placa inválida recusada (morador, Síndico e até a chave de serviço); cadastro também
for (const ruim of ['ABC123', 'ABC12345', 'AB1C234', 'ABC-123', '1BC1D23', 'ABCDE12', 'ABC1D2E', '']) {
  const rm = await cM2.from('vehicles').update({ placa: ruim }).eq('id', veicId).select('id');
  const rs = await cSind.from('vehicles').update({ placa: ruim }).eq('id', veicId).select('id');
  const rk = await admin.from('vehicles').update({ placa: ruim }).eq('id', veicId).select('id');
  ok(!!rm.error && !!rs.error && !!rk.error && (await linha('QAB3C45'))?.id === veicId, `[0031] placa inválida "${ruim}" recusada em edição (morador, Síndico e chave de serviço)`);
}
ok(!!(await cM2.from('vehicles').insert(veic('XX', { unidade: '102' }))).error, '[0031] morador NÃO cadastra veículo com placa inválida');
ok(!!(await cPort.from('vehicles').insert(veic('ABC-123'))).error, '[0031] Portaria NÃO cadastra veículo com placa inválida');
ok(!!(await cSind.from('vehicles').insert(veic('qaz9z9'))).error, '[0031] Síndico NÃO cadastra placa de 6 caracteres');
// 5) outra unidade: 0 linhas; Portaria, Conselho, visitante (sem login) e provisório: recusados
ok(!(await cM1.from('vehicles').update({ marca: 'Invasor' }).eq('id', veicId).select('id')).data?.length && (await linha('QAB3C45')).marca === 'Fiat', '[0031] morador1 NÃO edita veículo de OUTRA unidade (0 linhas)');
ok(!(await cM2.from('vehicles').update({ marca: 'Invasor' }).eq('id', veicOutraId).select('id')).data?.length && (await linha('QAA1B23')).marca !== 'Invasor', '[0031] morador2 NÃO edita veículo da Q-101 (0 linhas)');
for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons], ['visitante (sem login)', anon()], ['morador provisório', cProv]]) {
  const r = await c.from('vehicles').update({ placa: 'QAH8H88', marca: 'Invasor' }).eq('id', veicId).select('id');
  ok(!r.data?.length && (await linha('QAB3C45'))?.id === veicId && (await linha('QAB3C45')).marca === 'Fiat', `[0031] ${nome} NÃO edita placa nem marca`);
}
// 6) veículo de visitante: o morador não edita (o status é da equipe)
const visitanteId = (await linha('QAV0S01')).id;
const rv = await cM2.from('vehicles').update({ cor: 'Roxa' }).eq('id', visitanteId).select('id');
ok(!rv.data?.length && (await linha('QAV0S01')).cor !== 'Roxa', '[0031] morador NÃO edita veículo de VISITANTE da própria unidade');
// 7) equipe edita tudo
{
  const r = await cSind.from('vehicles').update({ placa: 'QAC4D56', vaga: 'Q777', cor: 'Cinza' }).eq('id', veicId).select();
  const l = await linha('QAC4D56');
  ok(r.data?.length === 1 && l?.vaga === 'Q777' && l.cor === 'Cinza', '[0031] Síndico edita placa, vaga e cor');
  const r2 = await cSub.from('vehicles').update({ proprietario_nome: 'QA Dono Novo', telefone_contato: '(11) 98888-7777', status: 'VISITANTE' }).eq('id', veicId).select();
  const l2 = await linha('QAC4D56');
  ok(r2.data?.length === 1 && l2.proprietario_nome === 'QA Dono Novo' && l2.status === 'VISITANTE', '[0031] Subsíndico edita proprietário, telefone e status');
  const r3 = await cAdm.from('vehicles').update({ marca: 'Honda', modelo: 'CG', status: 'ATIVO', tipo_veiculo: 'CARRO' }).eq('id', veicId).select();
  const l3 = await linha('QAC4D56');
  ok(r3.data?.length === 1 && l3.marca === 'Honda' && l3.status === 'ATIVO' && l3.tipo_veiculo === 'CARRO', '[0031] ADM edita marca, modelo, status e tipo');
  const { data: logs } = await admin.from('audit_logs').select('acao,detalhes').like('acao', 'Alterou um veículo da unidade 102 (Bloco Q): %').neq('usuario_role', 'MORADOR');
  ok(logs?.length === 3 && logs.every((x) => !/QAC4D56|QAB3C45/.test(x.acao)), '[0031] edições da equipe também entram no histórico, sem placa na frase');
  const sem = logs?.find((x) => /proprietário/.test(x.acao));
  ok(!!sem && !/QA Dono Novo|98888/.test(JSON.stringify(sem)) && sem.detalhes.camposAlteradosSemValor?.includes('telefone_contato'), '[0031] histórico NÃO guarda nome nem telefone do proprietário (só diz que mudaram)');
}
// 8) cadastro do morador: banco força status ATIVO, vaga vazia e unidade pela chave
{
  const r = await cM2.from('vehicles').insert(veic('qad5e67', { status: 'VISITANTE', vaga: 'Q999', bloco: 'Z', unidade: '999' })).select().single();
  ok(!r.error && r.data?.status === 'ATIVO' && r.data.vaga === '' && r.data.placa === 'QAD5E67', '[0031] cadastro do morador força status ATIVO, vaga vazia e placa em maiúsculas');
  ok(r.data?.bloco === 'Q' && r.data?.unidade === '102', '[0031] cadastro do morador ignora bloco/unidade do navegador (vêm da unidade)');
  const rs = await cSind.from('vehicles').insert(veic('QAE6F78', { status: 'VISITANTE', vaga: 'Q555' })).select().single();
  ok(!rs.error && rs.data?.status === 'VISITANTE' && rs.data.vaga === 'Q555', '[0031] equipe continua definindo status e vaga no cadastro');
}
// 9) placa única no condomínio (decisão do dono, 03/10/2026): repetida é recusada com 23505
{
  const existente = (await linha('QAC4D56')).id; // veículo da Q-102, criado/editado acima
  const dupCad = await cM1.from('vehicles').insert(veic('QAC4D56', { unidade: '101', unit_id: U['101'] }));
  ok(dupCad.error?.code === '23505', `[0031] morador NÃO cadastra placa já existente em outra unidade (23505: ${dupCad.error?.code})`);
  const dupCadMin = await cM1.from('vehicles').insert(veic('qac4d56', { unidade: '101', unit_id: U['101'] }));
  ok(dupCadMin.error?.code === '23505', '[0031] "qac4d56" e "QAC4D56" contam como a mesma placa (cadastro)');
  const dupEquipe = await cSind.from('vehicles').insert(veic('QAC4D56', { unidade: '101', unit_id: U['101'] }));
  ok(dupEquipe.error?.code === '23505', '[0031] Síndico NÃO cadastra placa já existente');
  const dupMesma = await cM2.from('vehicles').insert(veic('QAC4D56'));
  ok(dupMesma.error?.code === '23505', '[0031] morador NÃO cadastra a mesma placa duas vezes na própria unidade');
  const dupEd = await cM1.from('vehicles').update({ placa: 'qac4d56' }).eq('id', veicOutraId).select('id');
  ok(dupEd.error?.code === '23505' && (await linha('QAA1B23')).id === veicOutraId, '[0031] morador NÃO edita para uma placa já existente (23505; a placa dele fica como estava)');
  const dupEdEq = await cSind.from('vehicles').update({ placa: 'QAC4D56' }).eq('id', veicOutraId).select('id');
  ok(dupEdEq.error?.code === '23505', '[0031] Síndico NÃO edita para uma placa já existente');
  ok((await admin.from('vehicles').select('id').eq('placa', 'QAC4D56')).data?.length === 1, '[0031] continua só 1 veículo com a placa QAC4D56');
  // O dono da placa regrava a própria placa com o mesmo valor (e em minúsculas): continua funcionando
  const mesma = await cM2.from('vehicles').update({ placa: 'qac4d56', cor: 'Azul' }).eq('id', existente).select('id');
  ok(mesma.data?.length === 1 && (await linha('QAC4D56')).cor === 'Azul', '[0031] morador salva a própria placa com o mesmo valor (sem acusar duplicidade)');
  const semAviso = (await admin.from('notifications').select('id').eq('titulo', 'Placa repetida entre unidades')).data ?? [];
  ok(semAviso.length === 0, '[0031] nenhuma notificação de placa repetida existe (a regra caiu)');
}

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
  const tipoAud = descreverAuditoria('Alterou o tipo de um veículo da unidade 102 (Bloco A) de Outro para Moto', { vehicleId: 'v-1', de: 'OUTRO', para: 'MOTO' });
  igual(tipoAud.frase, 'Alterou o tipo de um veículo da unidade 102 (Bloco A) de Outro para Moto.', 'troca de tipo do veículo vira frase');
  ok(tipoAud.detalhes.length === 0 && tipoAud.tecnicos.some((t) => t.chave === 'vehicleId') && tipoAud.tecnicos.some((t) => t.chave === 'para'), 'troca de tipo: id e valores só em detalhes técnicos');
  const edAud = descreverAuditoria('Alterou um veículo da unidade 102 (Bloco A): placa, cor e tipo', { vehicleId: 'v-1', unidade: '102', bloco: 'A', alteracoes: { placa: { de: 'AAA1A11', para: 'BBB2B22' } } });
  igual(edAud.frase, 'Alterou um veículo da unidade 102 (Bloco A): placa, cor e tipo.', 'edição do veículo vira frase (sem placa)');
  ok(edAud.detalhes.length === 0 && edAud.tecnicos.some((t) => t.chave === 'alteracoes') && edAud.tecnicos.some((t) => t.chave === 'vehicleId'), 'edição do veículo: de-para e id só em detalhes técnicos');
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

console.log('\n## Excluir unidade: conta de equipe não é apagada (spec do ciclo da multa, item 1)');
{
  const perfilExiste = async (id) => !!(await admin.from('profiles').select('id').eq('id', id).maybeSingle()).data;
  const authExiste = async (id) => !!(await admin.auth.admin.getUserById(id)).data?.user;
  const unidadeCom = async (num, contaId) => (await admin.from('units').insert({ bloco: 'Q', numero: num, proprietario_nome: 'QA titular', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'PROPRIETARIO', moradores: [], vagas_garagem: [], animais: '', usuario_id: contaId, status_convite: 'ATIVO' }).select().single()).data;
  for (const [nome, chave, num] of [['Síndico', 'sindico', '301'], ['Subsíndico', 'subsindico', '302'], ['ADM', 'adm', '303'], ['Conselho', 'conselho', '304'], ['Portaria', 'portaria', '305']]) {
    const conta = (await admin.from('profiles').select('id').eq('email', email(chave)).single()).data;
    const u = await unidadeCom(num, conta.id);
    // Excluir a unidade como outro perfil de equipe (o Síndico exclui a dele mesma: a conta continua).
    const r = await api('/api/unidades/excluir', { method: 'POST', cookie: chave === 'sindico' ? ckSind : ckSub, body: { unitId: u.id } });
    ok(r.status === 200 && r.data.usuarioRemovido === false, `unidade ligada à conta ${nome} é excluída sem apagar a conta (${r.status}, usuarioRemovido=${r.data?.usuarioRemovido})`);
    ok((await perfilExiste(conta.id)) && (await authExiste(conta.id)), `conta ${nome} continua existindo (perfil e login)`);
    ok(!(await admin.from('units').select('id').eq('id', u.id)).data.length, `unidade da conta ${nome} foi excluída`);
  }
  const idMor = (await admin.from('profiles').select('id').eq('email', email('morador1')).single()).data.id;
  const uMor = await unidadeCom('306', idMor);
  const rMor = await api('/api/unidades/excluir', { method: 'POST', cookie: ckSind, body: { unitId: uMor.id } });
  ok(rMor.status === 200 && rMor.data.usuarioRemovido === true && !(await perfilExiste(idMor)) && !(await authExiste(idMor)), 'unidade de morador comum continua apagando a conta do morador');
}

console.log('\n## Prazo de recurso: só exibição (spec do ciclo da multa, item 3)');
{
  const igual = (obtido, esperado, nome) => ok(obtido === esperado, `${nome}: ${JSON.stringify(obtido)}`);
  // 15h UTC = 12h em São Paulo (UTC-3). 02h UTC do dia 2 ainda é 23h do dia 1 em São Paulo.
  const meioDia = new Date('2026-10-01T15:00:00Z');
  igual(situacaoDoPrazo('2026-09-30', meioDia), 'ENCERRADO', 'prazo de ontem');
  igual(situacaoDoPrazo('2026-10-01', meioDia), 'HOJE', 'prazo de hoje');
  igual(situacaoDoPrazo('2026-10-02', meioDia), 'ABERTO', 'prazo de amanhã');
  igual(situacaoDoPrazo('2026-10-01', new Date('2026-10-02T02:30:00Z')), 'HOJE', 'às 23h30 de SP o prazo do dia ainda vale (UTC já virou o dia)');
  igual(situacaoDoPrazo('2026-10-01', new Date('2026-10-02T03:00:00Z')), 'ENCERRADO', 'à 0h de SP do dia seguinte o prazo encerra');
  igual(situacaoDoPrazo('2026-10-01T00:00:00+00:00', meioDia), 'HOJE', 'valor com hora usa só a data');
  igual(situacaoDoPrazo('', meioDia), 'ABERTO', 'prazo vazio não quebra');
  igual(textoDoPrazo('2026-09-30', meioDia), 'Prazo encerrado em 30/09/2026', 'texto de prazo encerrado');
  igual(textoDoPrazo('2026-10-01', meioDia), 'Prazo até hoje', 'texto de prazo de hoje');
  igual(textoDoPrazo('2026-10-05', meioDia), 'Prazo até 05/10/2026', 'texto de prazo aberto');
}

console.log('\n## Excluir aviso e cancelar convite: só some se o banco apagou (spec confirmar exclusões)');
{
  // O app agora confere se a linha foi apagada (.select no delete). A RLS recusa em silêncio.
  const { data: av } = await cSind.from('notices').insert({ titulo: 'QA aviso a excluir', conteudo: 'QA', categoria: 'COMUNICADO', autor: 'QA' }).select().single();
  const negou = await cPort.from('notices').delete().eq('id', av.id).select('id');
  ok(!negou.error && negou.data.length === 0, 'Portaria: o banco recusa excluir aviso sem erro (retorna 0 linhas)');
  const negouM = await cM2.from('notices').delete().eq('id', av.id).select('id');
  ok(!negouM.error && negouM.data.length === 0, 'Morador: o banco recusa excluir aviso (0 linhas)');
  ok((await cSind.from('notices').delete().eq('id', av.id).select('id')).data.length === 1, 'Síndico exclui o aviso (1 linha)');
  const { data: cv } = await cAdm.from('pending_invites').insert({ nome: 'QA convite a cancelar', email: email('cancelar'), role: 'PORTARIA', status: 'PENDENTE' }).select().single();
  const negouC = await cM2.from('pending_invites').delete().eq('id', cv.id).select('id');
  ok(!negouC.error && negouC.data.length === 0, 'Morador: o banco recusa cancelar convite (0 linhas)');
  ok((await cAdm.from('pending_invites').delete().eq('id', cv.id).select('id')).data.length === 1, 'ADM cancela o convite (1 linha)');
}

console.log('\n## Anular e apagar multa (spec 2026-10-02): regra no banco, por API direta');
{
  // Conta própria: o morador1 já foi apagado na seção anterior (excluir unidade de morador comum).
  const { data: uA } = await admin.from('units').insert({ bloco: 'Q', numero: '401', proprietario_nome: 'QA A401', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'PROPRIETARIO', moradores: [] }).select().single();
  const idA = await criarUsuario(email('moradorA'), { name: 'QA moradorA', role: 'MORADOR', bloco: 'Q', unidade: '401' });
  await admin.from('units').update({ usuario_id: idA, status_convite: 'ATIVO' }).eq('id', uA.id);
  const cMA = await clientDe(email('moradorA'));
  const nova = async (n, extra = {}) => {
    const { data, error } = await cSind.from('fines').insert({ numero_protocolo: `QA-A${n}`, bloco: 'Q', unidade: '401', unit_id: uA.id, morador_nome: 'QA moradorA', data_infracao: hoje, prazo_recurso_data: daqui(10), artigo_regimento: 'Art. 2', descricao_infracao: 'QA descrição sigilosa', valor: 200, tipo: 'MULTA', ...extra }).select().single();
    if (error) throw new Error('nova multa: ' + error.message);
    return data;
  };
  const lerF = async (id) => (await admin.from('fines').select('*').eq('id', id).single()).data;
  const MOTIVO = 'Unidade errada na emissão da multa';
  const { data: pAdm } = await admin.from('profiles').select('id,name').eq('email', email('adm')).single();
  const { data: pSind } = await admin.from('profiles').select('id,name').eq('email', email('sindico')).single();
  const f1 = await nova(1);

  // Motivo obrigatório (mín. 10, máx. 500 depois do trim), para Síndico, Subsíndico e ADM.
  for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm]]) {
    for (const [desc, motivo] of [['sem motivo', undefined], ['motivo vazio', ''], ['só espaços', '            '], ['motivo curto (9)', '123456789'], ['10 só com espaços nas pontas', '  123456789  '], ['501 caracteres', 'x'.repeat(501)]]) {
      const r = await c.from('fines').update({ status: 'ANULADA', ...(motivo === undefined ? {} : { anulada_motivo: motivo }) }).eq('id', f1.id).select('id');
      ok(!!r.error && (await lerF(f1.id)).status === 'PENDENTE_CIENCIA', `${nome} anula ${desc}: recusado e a multa não muda${r.error ? ` ("${r.error.message}")` : ''}`);
    }
  }
  ok(/pelo menos 10 caracteres/.test((await cSind.from('fines').update({ status: 'ANULADA', anulada_motivo: 'curto' }).eq('id', f1.id)).error?.message ?? ''), 'mensagem de motivo curto em português');

  // Carimbo de quem/quando é do servidor: o que o cliente manda é ignorado.
  const forjado = await cSind.from('fines').update({ status: 'ANULADA', anulada_motivo: `  ${MOTIVO}  `, anulada_por: pAdm.id, anulada_por_nome: 'Fulano Forjado', anulada_por_papel: 'ADM', anulada_em: '2000-01-01T00:00:00Z' }).eq('id', f1.id).select().single();
  ok(!forjado.error && forjado.data.status === 'ANULADA', `Síndico anula com motivo ${forjado.error?.message ?? ''}`);
  const a1 = await lerF(f1.id);
  ok(a1.anulada_por === pSind.id && a1.anulada_por_nome === pSind.name && a1.anulada_por_papel === 'SINDICO', 'quem anulou é o usuário logado (valores forjados ignorados)');
  ok(Math.abs(Date.now() - new Date(a1.anulada_em).getTime()) < 120000, 'data da anulação é a do servidor (forjada 2000-01-01 ignorada)');
  ok(a1.anulada_motivo === MOTIVO, 'motivo gravado já sem espaços nas pontas');
  ok(a1.valor == 200 && a1.artigo_regimento === 'Art. 2', 'anular não apaga nenhum outro campo');
  const { data: logA } = await admin.from('audit_logs').select('*').eq('acao', 'Anulou multa QA-A1');
  ok(logA?.length === 1 && logA[0].modulo === 'MULTAS' && logA[0].usuario_id === pSind.id && logA[0].usuario_role === 'SINDICO' && logA[0].detalhes.motivo === MOTIVO && logA[0].detalhes.statusAnterior === 'PENDENTE_CIENCIA', 'anular grava no histórico (gatilho do banco), com motivo e status anterior');
  ok((await cCons.from('audit_logs').select('id').eq('acao', 'Anulou multa QA-A1')).data.length === 1, 'Conselho lê o registro da anulação');

  // Estado final: ninguém desfaz nem muda, nem o ADM.
  for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm]]) {
    ok(!!(await c.from('fines').update({ status: 'CIENCIA_REGISTRADA' }).eq('id', f1.id)).error, `${nome} NÃO reativa multa anulada`);
    ok(!!(await c.from('fines').update({ anulada_motivo: 'Outro motivo qualquer aqui' }).eq('id', f1.id)).error, `${nome} NÃO troca o motivo da anulação`);
    ok(!!(await c.from('fines').update({ status: 'ANULADA', anulada_motivo: 'Anulando de novo a mesma multa' }).eq('id', f1.id)).error, `${nome} anular multa já anulada: recusado`);
  }
  ok((await lerF(f1.id)).anulada_motivo === MOTIVO && (await lerF(f1.id)).status === 'ANULADA', 'multa anulada continua intacta');
  ok(!!(await cSind.from('fines').update({ anulada_motivo: 'x'.repeat(12) }).eq('id', (await nova(2)).id)).error, 'campos da anulação não valem numa multa que não está ANULADA');
  ok(!!(await cSind.from('fines').insert({ numero_protocolo: 'QA-A3', bloco: 'Q', unidade: '101', unit_id: uA.id, morador_nome: 'QA', data_infracao: hoje, prazo_recurso_data: daqui(10), artigo_regimento: 'A', descricao_infracao: 'QA', valor: 1, tipo: 'MULTA', status: 'ANULADA', anulada_motivo: MOTIVO, anulada_em: new Date().toISOString() })).error, 'multa nova não nasce ANULADA (escaparia da regra)');

  // Quem não pode anular, por API direta.
  const f2 = await nova(4);
  const antes = async () => (await lerF(f2.id)).status;
  ok(!!(await cMA.from('fines').update({ status: 'ANULADA', anulada_motivo: MOTIVO }).eq('id', f2.id)).error && (await antes()) === 'PENDENTE_CIENCIA', 'Morador dono NÃO anula a própria multa');
  ok(!!(await cMA.from('fines').update({ anulada_motivo: MOTIVO, anulada_em: new Date().toISOString() }).eq('id', f2.id)).error, 'Morador dono NÃO grava campos da anulação (guard 0024)');
  ok(!(await cM2.from('fines').select('id').eq('id', f2.id)).data.length, 'Morador de OUTRA unidade nem vê a multa');
  await cM2.from('fines').update({ status: 'ANULADA', anulada_motivo: MOTIVO }).eq('id', f2.id);
  ok((await antes()) === 'PENDENTE_CIENCIA', 'Morador de outra unidade NÃO anula');
  await cCons.from('fines').update({ status: 'ANULADA', anulada_motivo: MOTIVO }).eq('id', f2.id);
  ok((await antes()) === 'PENDENTE_CIENCIA', 'Conselho NÃO anula');
  await cPort.from('fines').update({ status: 'ANULADA', anulada_motivo: MOTIVO }).eq('id', f2.id);
  ok((await antes()) === 'PENDENTE_CIENCIA', 'Portaria NÃO anula');
  await anon().from('fines').update({ status: 'ANULADA', anulada_motivo: MOTIVO }).eq('id', f2.id);
  ok((await antes()) === 'PENDENTE_CIENCIA', 'Visitante NÃO anula');
  await cX.from('fines').update({ status: 'ANULADA', anulada_motivo: MOTIVO }).eq('id', f2.id);
  ok((await antes()) === 'PENDENTE_CIENCIA', 'Conta sem perfil NÃO anula');

  // Recurso deferido já é uma anulação; recurso em análise é encerrado, sem perder nada.
  const f3 = await nova(5);
  await cSind.from('fines').update({ status: 'RECURSO_DEFERIDO', recurso_status: 'DEFERIDO', recurso_resposta: 'QA' }).eq('id', f3.id);
  ok(!!(await cSind.from('fines').update({ status: 'ANULADA', anulada_motivo: MOTIVO }).eq('id', f3.id)).error && (await lerF(f3.id)).status === 'RECURSO_DEFERIDO', 'anular multa RECURSO_DEFERIDO: recusado');
  const f4 = await nova(6);
  await cMA.from('fines').update({ status: 'CIENCIA_REGISTRADA', ciencia_data: new Date().toISOString(), ciencia_usuario_nome: 'QA moradorA' }).eq('id', f4.id);
  await cMA.from('fines').update({ status: 'EM_RECURSO', recurso_texto: 'QA texto do recurso', recurso_data: new Date().toISOString(), recurso_status: 'EM_ANALISE', recurso_anexo_nome: 'prova.pdf' }).eq('id', f4.id);
  ok(!(await cSub.from('fines').update({ status: 'ANULADA', anulada_motivo: MOTIVO }).eq('id', f4.id)).error, 'Subsíndico anula multa EM_RECURSO');
  const a4 = await lerF(f4.id);
  ok(a4.recurso_texto === 'QA texto do recurso' && a4.recurso_anexo_nome === 'prova.pdf' && a4.recurso_status === 'EM_ANALISE' && !a4.recurso_resposta && a4.ciencia_data, 'recurso encerrado sem julgamento: texto, anexo e ciência preservados, recurso_status não vira deferido/indeferido');
  ok(!!(await cMA.from('fines').update({ recurso_texto: 'mexendo depois de anulada' }).eq('id', f4.id)).error && (await lerF(f4.id)).recurso_texto === 'QA texto do recurso', 'Morador NÃO altera multa anulada');
  const lidaM1 = await cMA.from('fines').select('status,anulada_motivo,anulada_por_papel').eq('id', f4.id).single();
  ok(lidaM1.data?.status === 'ANULADA' && lidaM1.data.anulada_motivo === MOTIVO, 'Morador dono continua vendo a multa anulada, com o motivo');

  // Apagar: só o ADM.
  const f5 = await nova(7, { valor: 350 });
  for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['Conselho', cCons], ['Portaria', cPort], ['Morador dono', cMA], ['Morador de outra unidade', cM2], ['Visitante', anon()], ['Conta sem perfil', cX]]) {
    const r = await c.from('fines').delete().eq('id', f5.id).select('id');
    ok(!(r.data?.length) && !!(await lerF(f5.id)), `${nome} NÃO apaga multa (${r.error ? 'erro: ' + r.error.message : '0 linhas'}) e ela continua lá`);
  }
  ok(!(await admin.from('audit_logs').select('id').eq('acao', 'Apagou multa QA-A7')).data.length, 'tentativas recusadas não deixam registro de exclusão');
  const apagou = await cAdm.from('fines').delete().eq('id', f5.id).select('id');
  ok(apagou.data?.length === 1 && !(await lerF(f5.id)), 'ADM apaga a multa (1 linha)');
  ok(!(await cMA.from('fines').select('id').eq('id', f5.id)).data.length && !(await cSind.from('fines').select('id').eq('id', f5.id)).data.length, 'multa apagada some para morador e equipe');
  const { data: logD } = await admin.from('audit_logs').select('*').eq('acao', 'Apagou multa QA-A7');
  const dD = logD?.[0]?.detalhes ?? {};
  ok(logD?.length === 1 && logD[0].usuario_id === pAdm.id && logD[0].usuario_role === 'ADM' && logD[0].usuario_nome === pAdm.name, 'apagar grava no histórico (gatilho) com nome, perfil e id de quem apagou');
  ok(dD.protocolo === 'QA-A7' && dD.unidade === '401' && dD.bloco === 'Q' && dD.tipo === 'MULTA' && Number(dD.valor) === 350 && dD.statusAnterior === 'PENDENTE_CIENCIA', 'registro de exclusão traz protocolo, unidade, bloco, tipo, valor e status');
  ok(!/QA moradorA|sigilosa|recurso_texto|Art\. 2/.test(JSON.stringify(logD?.[0])), 'registro de exclusão NÃO guarda nome do morador, descrição, recurso ou artigo (LGPD)');
  // ADM apaga também multa anulada (e a em recurso): "ADM apaga qualquer uma".
  ok((await cAdm.from('fines').delete().eq('id', f1.id).select('id')).data?.length === 1, 'ADM apaga também uma multa já anulada');
  ok((await cAdm.from('fines').delete().eq('id', f4.id).select('id')).data?.length === 1, 'ADM apaga multa anulada que estava em recurso');

  // O histórico não é editável nem apagável pelo app.
  const algum = (await admin.from('audit_logs').select('id').eq('acao', 'Anulou multa QA-A1')).data[0];
  for (const [nome, c] of [['Síndico', cSind], ['ADM', cAdm], ['Conselho', cCons], ['Morador', cMA]]) {
    const u = await c.from('audit_logs').update({ acao: 'adulterado' }).eq('id', algum.id).select('id');
    const d = await c.from('audit_logs').delete().eq('id', algum.id).select('id');
    ok(!u.data?.length && !d.data?.length, `${nome} NÃO edita nem apaga registro do histórico`);
  }
  ok((await admin.from('audit_logs').select('acao').eq('id', algum.id).single()).data.acao === 'Anulou multa QA-A1', 'registro do histórico continua como estava');

  // Frases legíveis para a tela de Relatórios.
  {
    const igual = (obtido, esperado, nome) => ok(obtido === esperado, `${nome}: ${JSON.stringify(obtido)}`);
    igual(descreverAuditoria('Anulou multa NOT-2026/004', { fineId: 'x', protocolo: 'NOT-2026/004', unidade: '101', bloco: 'A', statusAnterior: 'PENDENTE_CIENCIA', motivo: 'Unidade errada' }).frase, 'Multa NOT-2026/004 (unidade 101, bloco A) anulada. Motivo: Unidade errada', 'anulação vira frase');
    igual(descreverAuditoria('Anulou multa NOT-2026/004', { fineId: 'x', protocolo: 'NOT-2026/004', unidade: '101', bloco: 'A', motivo: 'Unidade errada' }).tecnicos.map((t) => t.chave).join(), 'fineId', 'id da multa só em detalhes técnicos');
    ok(/^Multa NOT-2026\/005 \(unidade 7, bloco B, multa de R\$\s350,00, estava em recurso\) apagada\.$/.test(descreverAuditoria('Apagou multa NOT-2026/005', { fineId: 'x', protocolo: 'NOT-2026/005', unidade: '7', bloco: 'B', tipo: 'MULTA', valor: 350, statusAnterior: 'EM_RECURSO' }).frase), 'exclusão vira frase com tipo, valor e estado');
    igual(descreverAuditoria('Apagou multa NOT-2026/006', { protocolo: 'NOT-2026/006', unidade: '7', bloco: 'B', tipo: 'ADVERTENCIA', valor: 0, statusAnterior: 'PENDENTE_CIENCIA' }).frase, 'Multa NOT-2026/006 (unidade 7, bloco B, advertência, estava aguardando ciência) apagada.', 'exclusão de advertência não mostra valor');
  }
}

await limparQA();
resumo();
