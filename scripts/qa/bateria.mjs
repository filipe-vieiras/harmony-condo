// Bateria completa: fluxos por perfil + segurança. QA_ALVO=staging|producao.
import { formatarData, formatarMoeda, formatarHorario, formatarIntervalo, pluralizar, situacaoDoPrazo, textoDoPrazo } from '../../src/lib/formatadores.ts';
import { descreverAuditoria } from '../../src/lib/auditoria.ts';
import { avaliarVinculo } from '../../src/lib/vinculoUnidade.ts';
import { rodarTransferirCargo } from './transferir-cargo.mjs';
import { rodarZelador } from './zelador.mjs';
import { rodarHierarquia } from './hierarquia.mjs';
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

console.log('\n## M. Documento do titular fora de Portaria e Conselho (issue #67, migração 0040)');
{
  const DOC_A = '999.111.222-33', DOC_B = '888.111.222-44', DOC_C = '444.555.666-77', DOC_D = '777.666.555-11';
  const todos = [DOC_A, DOC_B, DOC_C, DOC_D];
  const vaza = (d) => { const t = JSON.stringify(d ?? ''); return todos.some((x) => t.includes(x)) || /rgCpf/.test(t); };
  const moradoresDe = async (unitId) => (await admin.from('units').select('moradores').eq('id', unitId).single()).data.moradores;
  const docsDe = async (unitId) => (await admin.from('unit_documentos').select('*').eq('unit_id', unitId)).data ?? [];

  // Contas e unidades da seção. conselho2 MORA em R-901 (é titular de unidade) e mesmo assim não lê o documento.
  const { data: [uR1, uR2] } = await admin.from('units').insert([
    { bloco: 'R', numero: '901', proprietario_nome: 'QA Conselho Dois', proprietario_telefone: '(11) 90000-9901', proprietario_email: 'qa-c2@example.com', tipo_ocupacao: 'PROPRIETARIO', moradores: [{ nome: 'QA Conselho Dois', tipo: 'TITULAR', telefone: '(11) 90000-9901', email: 'qa-c2@example.com', rgCpf: 'DEVE-SER-REMOVIDO' }], vagas_garagem: [], animais: '' },
    { bloco: 'R', numero: '902', proprietario_nome: '', proprietario_telefone: '', proprietario_email: '', tipo_ocupacao: 'DESOCUPADO', moradores: [], vagas_garagem: [], animais: '' },
  ]).select();
  const idC2 = await criarUsuario(email('conselho2doc'), { name: 'QA Conselho Dois', role: 'CONSELHO', bloco: 'R', unidade: '901' });
  await admin.from('units').update({ usuario_id: idC2, status_convite: 'ATIVO' }).eq('id', uR1.id);
  await criarUsuario(email('portaria2doc'), { name: 'QA Portaria Dois', role: 'PORTARIA' });
  await criarUsuario(email('prov67'), { name: 'QA provisório67', role: 'MORADOR', bloco: 'Q', unidade: '101', cadastro_validado: false });
  await criarUsuario(email('semperfil67'));
  const cX = await clientDe(email('semperfil67'));
  const cC2 = await clientDe(email('conselho2doc')), cP2 = await clientDe(email('portaria2doc')), cProv = await clientDe(email('prov67'));

  // Gatilho de units: o JSON nunca guarda documento (mesmo que um cliente tente) e todo morador ganha id.
  const m901 = await moradoresDe(uR1.id);
  ok(!JSON.stringify(m901).includes('rgCpf') && !!m901[0].id, 'gatilho: documento enviado dentro do JSON de units é descartado e o morador ganha id');
  const nomeAntes = m901[0].nome;
  ok((await docsDe(uR1.id)).length === 0, 'documento mandado no JSON NÃO vira documento guardado (some)');

  // Documentos de teste, gravados como o app grava: pela função da gestão (Síndico, Subsíndico e ADM).
  const mA = await moradoresDe(U['101']), mB = await moradoresDe(U['102']);
  const idsA = mA.map((m) => m.id), idsB = mB.map((m) => m.id);
  ok(idsA.every(Boolean) && idsB.every(Boolean), 'moradores validados pelo autocadastro têm id');
  ok(!(await cSind.rpc('salvar_documentos_unidade', { p_unit_id: U['101'], p_docs: { [idsA[0]]: DOC_A }, p_manter: idsA })).error, 'Síndico grava o documento do titular de Q-101 pela função');
  ok(!(await cSub.rpc('salvar_documentos_unidade', { p_unit_id: U['102'], p_docs: { [idsB[0]]: DOC_B }, p_manter: idsB })).error, 'Subsíndico grava o documento do titular de Q-102 pela função');
  await admin.from('unit_documentos').insert({ unit_id: uR1.id, morador_id: m901[0].id, documento: DOC_D });
  ok((await docsDe(U['101'])).length === 1 && (await docsDe(U['102'])).length === 1, 'dois documentos gravados, um em cada unidade');

  // Quem lê: gestão lê tudo; o morador só o da própria unidade.
  for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm]]) {
    const r = await c.from('unit_documentos').select('unit_id,morador_id,documento');
    const vals = (r.data ?? []).map((d) => d.documento);
    ok(!r.error && vals.includes(DOC_A) && vals.includes(DOC_B) && vals.includes(DOC_D), `${nome} lê os documentos de todas as unidades`);
  }
  const rM1 = await cM1.from('unit_documentos').select('documento');
  ok(rM1.data?.length === 1 && rM1.data[0].documento === DOC_A, 'Morador lê só o documento da PRÓPRIA unidade (Q-101)');
  const rM2 = await cM2.from('unit_documentos').select('documento');
  ok(rM2.data?.length === 1 && rM2.data[0].documento === DOC_B, 'Morador de outra unidade lê só o da dele (Q-102) e nunca o de Q-101');
  ok(!(await cM2.from('unit_documentos').select('documento').eq('unit_id', U['101'])).data?.length, 'Morador de outra unidade pedindo Q-101 por filtro: 0 linhas');

  // Quem NÃO lê: Portaria, Conselho, Portaria2, Conselho2 (titular de unidade), provisório, visitante, conta sem perfil.
  const naoLe = [['Portaria', cPort], ['Conselho', cCons], ['Portaria2', cP2], ['Conselho2 (titular de R-901, com documento lá)', cC2], ['Morador provisório', cProv], ['Visitante', anon()], ['Conta sem perfil', cX]];
  for (const [nome, c] of naoLe) {
    const t = await c.from('unit_documentos').select('*');
    ok(!(t.data?.length), `${nome} NÃO lê unit_documentos (${t.error ? 'erro: ' + t.error.code : '0 linhas'})`);
    const u = await c.from('units').select('*');
    ok(!vaza(u.data), `${nome} NÃO recebe documento em units (${u.data?.length ?? 0} unidades lidas, nenhuma com rgCpf nem com o valor)`);
    const d = await c.rpc('diretorio_unidades');
    ok(!vaza(d.data), `${nome} NÃO recebe documento por diretorio_unidades`);
  }
  // Visão geral da API: nenhuma tabela legível por eles contém o valor.
  for (const [nome, c] of naoLe.slice(0, 4)) {
    const achados = [];
    for (const tb of ['units', 'vehicles', 'fines', 'notifications', 'audit_logs', 'autocadastros', 'profiles', 'pending_invites', 'unit_documentos']) {
      const r = await c.from(tb).select('*');
      if (!r.error && vaza(r.data)) achados.push(tb);
    }
    ok(achados.length === 0, `${nome}: valor do documento não aparece em nenhuma tabela legível ${achados.join(' ')}`);
  }

  // Equipe que lê units continua vendo telefone, e-mail e responsável.
  for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons], ['Portaria2', cP2], ['Conselho2', cC2]]) {
    const r = await c.from('units').select('id,proprietario_nome,proprietario_telefone,proprietario_email,moradores').eq('id', uR1.id).maybeSingle();
    const m = r.data?.moradores?.[0];
    ok(r.data?.proprietario_nome === 'QA Conselho Dois' && r.data.proprietario_telefone === '(11) 90000-9901' && r.data.proprietario_email === 'qa-c2@example.com' && m?.nome === nomeAntes && m.telefone === '(11) 90000-9901' && m.email === 'qa-c2@example.com', `${nome} continua lendo responsável, telefone e e-mail das unidades (sem o documento)`);
  }

  // Escrita direta pelo cliente: recusada para todos, inclusive a gestão (só a função grava).
  const alvo = { unit_id: U['101'], morador_id: idsA[0] };
  for (const [nome, c] of [...naoLe, ['Morador dono', cM1], ['Morador de outra unidade', cM2], ['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm]]) {
    const ins = await c.from('unit_documentos').insert({ unit_id: U['104'], morador_id: 'x', documento: 'QA-INSERT' });
    const upd = await c.from('unit_documentos').update({ documento: 'QA-ADULTERADO' }).match(alvo).select();
    const del = await c.from('unit_documentos').delete().match(alvo).select();
    ok(!!ins.error && !upd.data?.length && !del.data?.length, `${nome}: escrita direta em unit_documentos recusada (insert/update/delete)`);
  }
  const depois = await docsDe(U['101']);
  ok(depois.length === 1 && depois[0].documento === DOC_A, 'documento continua intacto depois das tentativas diretas');
  ok(!(await docsDe(U['104'])).length, 'nenhum documento criado por insert direto');

  // A função de gravação: só a gestão.
  for (const [nome, c] of [...naoLe, ['Morador dono', cM1], ['Morador de outra unidade', cM2]]) {
    const r = await c.rpc('salvar_documentos_unidade', { p_unit_id: U['101'], p_docs: { [idsA[0]]: 'QA-FUNCAO' }, p_manter: idsA });
    ok(!!r.error && (await docsDe(U['101']))[0].documento === DOC_A, `${nome} NÃO grava documento pela função (${r.error?.code ?? 'sem erro'})`);
  }
  // Documento solto: id que não é de morador da unidade é ignorado; texto vazio apaga; sair da unidade apaga.
  await cSind.rpc('salvar_documentos_unidade', { p_unit_id: U['101'], p_docs: { 'id-inventado': 'QA-SOLTO' }, p_manter: idsA });
  ok((await docsDe(U['101'])).length === 1, 'função ignora id que não é morador da unidade');
  await cSind.rpc('salvar_documentos_unidade', { p_unit_id: U['101'], p_docs: { [idsA[0]]: '' }, p_manter: idsA });
  ok((await docsDe(U['101'])).length === 0, 'texto vazio apaga o documento');
  await cSind.rpc('salvar_documentos_unidade', { p_unit_id: U['101'], p_docs: { [idsA[0]]: DOC_A }, p_manter: idsA });
  await cSind.rpc('salvar_documentos_unidade', { p_unit_id: U['101'], p_docs: {}, p_manter: [] });
  ok((await docsDe(U['101'])).length === 0, 'morador que saiu da unidade (fora de p_manter) perde o documento');
  await cSind.rpc('salvar_documentos_unidade', { p_unit_id: U['101'], p_docs: { [idsA[0]]: DOC_A }, p_manter: idsA });

  // Editar a unidade pela gestão (JSON com rgCpf) não devolve o documento ao JSON; o id continua o mesmo.
  const upJson = await cSind.from('units').update({ moradores: mA.map((m, i) => (i === 0 ? { ...m, rgCpf: DOC_C } : m)) }).eq('id', U['101']).select('moradores').single();
  ok(!upJson.error && !JSON.stringify(upJson.data.moradores).includes('rgCpf') && upJson.data.moradores[0].id === idsA[0], 'gestão salvando a unidade com rgCpf no JSON: banco descarta a chave e mantém o id');
  ok((await docsDe(U['101']))[0].documento === DOC_A, 'e o documento guardado não muda por causa disso');

  // Autocadastro: o documento do envio só a gestão (e o dono do envio) lê; ao validar, vai para a tabela nova.
  const IPm = () => ({ 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250) + 1}` });
  const env67 = await api('/api/autocadastro/publico', { method: 'POST', headers: IPm(), body: { unitId: uR2.id, tipo: 'PROPRIETARIO', nome: 'QA morador67', telefone: '(11) 90000-0067', rgCpf: DOC_C, email: email('morador67'), senha: SENHA, consentimento: true, dependentes: [], veiculos: [] } });
  ok(env67.status === 200, `autocadastro com documento aceito (${env67.status})`);
  const linha = (await admin.from('autocadastros').select('id,rg_cpf').eq('email', email('morador67')).single()).data;
  ok(linha?.rg_cpf === DOC_C, 'autocadastros guarda o documento do envio');
  for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons], ['Portaria2', cP2], ['Conselho2', cC2], ['Morador de outra unidade', cM2], ['Provisório de outro envio', cProv], ['Visitante', anon()], ['Conta sem perfil', cX]]) {
    const r = await c.from('autocadastros').select('*');
    ok(!vaza(r.data), `${nome} NÃO lê o documento do envio em autocadastros`);
  }
  ok((await cSind.from('autocadastros').select('rg_cpf').eq('id', linha.id).single()).data?.rg_cpf === DOC_C, 'gestão lê o documento do envio');
  const v67 = await api('/api/autocadastro/decidir', { method: 'POST', cookie: ckSind, body: { ids: [linha.id], acao: 'VALIDAR' } });
  ok(v67.status === 200 && v67.data.resultados?.[0]?.ok, `Síndico valida o envio com documento (${v67.data?.resultados?.[0]?.mensagem})`);
  const m902 = await moradoresDe(uR2.id);
  ok(m902.length === 1 && !JSON.stringify(m902).includes('rgCpf') && !!m902[0].id, 'depois de validar: units.moradores sem documento, com id');
  const d902 = await docsDe(uR2.id);
  ok(d902.length === 1 && d902[0].morador_id === m902[0].id && d902[0].documento === DOC_C, 'depois de validar: documento está em unit_documentos, ligado ao titular');
  const cM67 = await clientDe(email('morador67'));
  ok((await cM67.from('unit_documentos').select('documento')).data?.[0]?.documento === DOC_C, 'o novo morador lê o próprio documento');
  for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons]]) {
    ok(!vaza((await c.from('units').select('*').eq('id', uR2.id)).data), `${nome} lê a unidade recém-validada sem o documento`);
  }

  // Excluir a unidade leva o documento junto (ON DELETE CASCADE): sem documento de unidade que não existe mais.
  const antesExcluir = (await admin.from('unit_documentos').select('*', { count: 'exact', head: true })).count;
  await admin.from('units').delete().eq('id', uR1.id);
  ok((await admin.from('unit_documentos').select('*', { count: 'exact', head: true })).count === antesExcluir - 1, 'excluir a unidade apaga o documento dela');

  // Migração (0040) conferida: nada sobrou de documento no JSON de nenhuma unidade do banco.
  const { data: tudo } = await admin.from('units').select('moradores');
  ok(!tudo.some((u) => JSON.stringify(u.moradores).includes('rgCpf')), 'nenhuma unidade do banco guarda rgCpf no JSON (migração aplicada e gatilho ativo)');
  ok(tudo.every((u) => (u.moradores ?? []).every((m) => !!m.id)), 'todo morador de todas as unidades tem id');
  ok(!(await anon().from('unit_documentos').select('*')).data?.length, 'visitante sem login não lê nada de unit_documentos');
}

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
ok(!(await admin.from('reservations').select('id').eq('morador_nome', 'QA autoaprovada').eq('status', 'APROVADA')).data.length, 'morador NÃO cria reserva já aprovada (desde a 0034 o banco ignora o status enviado e grava PENDENTE)');
ok(!(await reserva(cPort, 'Q', '102', 'QA via portaria', 'PENDENTE', 10)).error, 'Portaria registra pedido em nome de morador');
await reserva(cPort, 'Q', '102', 'QA portaria aprovada', 'APROVADA', 11);
ok(!(await admin.from('reservations').select('id').eq('morador_nome', 'QA portaria aprovada').eq('status', 'APROVADA')).data.length, 'Portaria NÃO cria reserva já aprovada (espaço que exige aprovação)');
ok(!(await reserva(cCons, 'Q', '102', 'QA via conselho', 'PENDENTE', 12)).error, 'Conselho registra pedido em nome de morador');
ok(!(await reserva(cSind, 'Q', '102', 'QA síndico aprovada', 'APROVADA', 13)).error, 'Síndico cria reserva já aprovada');
const { data: rv1 } = await admin.from('reservations').select('id').eq('morador_nome', 'QA morador1').single();
ok(!(await cPort.from('reservations').update({ status: 'APROVADA' }).eq('id', rv1.id).select()).data?.length, 'Portaria não aprova (só Síndico/Subsíndico/ADM)');
ok((await cSub.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA Subsíndico' }).eq('id', rv1.id).select()).data?.length === 1, 'Subsíndico aprova');

console.log('\n## I2. Reservas: conflito no banco, disponibilidade e aprovação por espaço (issue #49, migrações 0032 a 0034)');
{
  const brHoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const somaDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const hojeBR = brHoje();
  const base = { descricao: 'QA', capacidade_max: 20, horario_funcionamento: '10h-22h', taxa_limpeza: 0, regras: [] };
  const { data: espA } = await cSind.from('spaces').insert({ ...base, nome: 'QA Salão aprovação' }).select().single();
  const { data: espB } = await cSind.from('spaces').insert({ ...base, nome: 'QA Quadra livre', exige_aprovacao: false }).select().single();
  const { data: espI } = await cSind.from('spaces').insert({ ...base, nome: 'QA Espaço inativo', ativo: false }).select().single();
  ok(espA?.exige_aprovacao === true, 'espaço novo exige aprovação por padrão');
  const rv = (c, e, bloco, un, nome, dia, status = 'PENDENTE') => c.from('reservations').insert({ espaco_id: e.id, espaco_nome: e.nome, bloco, unidade: un, morador_nome: nome, data: dia, horario_inicio: '12:00', horario_fim: '16:00', convidados_estimados: 5, status }).select().single();
  const statusDe = async (id) => (await admin.from('reservations').select('status,avaliado_por,data_avaliacao').eq('id', id).single()).data;

  // — Aprovação definida pelo banco —
  const forcada = await rv(cM1, espA, 'Q', '101', 'QA morador1', daqui(20), 'APROVADA');
  ok(!forcada.error && forcada.data.status === 'PENDENTE' && !forcada.data.avaliado_por, 'morador NÃO força APROVADA em espaço que exige aprovação (sai PENDENTE, sem avaliador)');
  const falsaAval = await rv(cM1, espA, 'Q', '101', 'QA morador1', daqui(21), 'APROVADA');
  ok(falsaAval.data?.status === 'PENDENTE', 'idem em outro dia');
  const auto = await rv(cM2, espB, 'Q', '102', 'QA morador2', daqui(20), 'PENDENTE');
  const autoLinha = auto.data && await statusDe(auto.data.id);
  ok(autoLinha?.status === 'APROVADA' && autoLinha.avaliado_por === 'Aprovação automática' && autoLinha.data_avaliacao, 'espaço sem aprovação: reserva nasce APROVADA com marcador do sistema (mesmo enviando PENDENTE)');
  ok(auto.data && (await rv(cM2, espB, 'Q', '102', 'QA morador2', daqui(22), 'RECUSADA')).data?.status === 'APROVADA', 'status RECUSADA enviado pelo morador também é ignorado');
  const forjada = await rv(cM2, espB, 'Q', '101', 'QA forjada49', daqui(23));
  ok(!!forjada.error, 'morador2 NÃO reserva em nome de outra unidade nem em espaço sem aprovação');
  // Espaços diferentes no mesmo dia: o pedido da Q-101 em espA (dia 20) e o da Q-102 em espB (dia 20) coexistem.
  ok(!forcada.error && !auto.error, 'dois espaços diferentes no mesmo dia: ambos aceitos');

  // — Conflito —
  const confl = await rv(cM2, espA, 'Q', '102', 'QA morador2', daqui(20));
  ok(!!confl.error && confl.error.code === '23505', `outro morador no mesmo espaço e dia: recusado pelo banco (${confl.error?.code})`);
  const conflApi = await rv(cM1, espA, 'Q', '101', 'QA morador1', daqui(20));
  ok(conflApi.error?.code === '23505', 'o mesmo morador também não duplica o dia');
  const corrida = await Promise.all([rv(cM1, espA, 'Q', '101', 'QA corrida1', daqui(30)), rv(cM2, espA, 'Q', '102', 'QA corrida2', daqui(30)), rv(cPort, espA, 'Q', '102', 'QA corrida3', daqui(30)), rv(cSind, espA, 'Q', '102', 'QA corrida4', daqui(30)), rv(cM1, espA, 'Q', '101', 'QA corrida5', daqui(30))]);
  ok(corrida.filter((r) => !r.error).length === 1 && (await admin.from('reservations').select('id').eq('espaco_id', espA.id).eq('data', daqui(30))).data.length === 1, `5 pedidos simultâneos: só 1 reserva (${corrida.filter((r) => !r.error).length} aceitos)`);
  // Recusada e cancelada liberam o dia.
  ok((await cSub.from('reservations').update({ status: 'RECUSADA', motivo_recusa: 'QA' }).eq('id', forcada.data.id).select()).data?.length === 1, 'Subsíndico recusa o pedido do dia 20');
  const apos = await rv(cM2, espA, 'Q', '102', 'QA morador2', daqui(20));
  ok(!apos.error, 'recusada libera o dia: novo pedido aceito');
  ok((await cAdm.from('reservations').update({ status: 'CANCELADA' }).eq('id', apos.data.id).select()).data?.length === 1, 'ADM cancela');
  const apos2 = await rv(cM1, espA, 'Q', '101', 'QA morador1', daqui(20));
  ok(!apos2.error, 'cancelada libera o dia: novo pedido aceito');
  const reativa = await cSind.from('reservations').update({ status: 'PENDENTE' }).eq('id', apos.data.id).select();
  ok(reativa.error?.message === 'reserva_encerrada', `reserva cancelada não é reaberta por ninguém, nem pela gestão (${reativa.error?.message})`);

  // — Dia passado e espaço inativo —
  const ontem = await rv(cM1, espA, 'Q', '101', 'QA passado', somaDias(hojeBR, -1));
  ok(ontem.error?.message === 'reserva_dia_passado', `dia passado (America/Sao_Paulo) recusado no banco (${ontem.error?.message})`);
  const hojeRv = await rv(cM1, espB, 'Q', '101', 'QA hoje', hojeBR);
  ok(!hojeRv.error, 'hoje (Brasília) é aceito: sem antecedência mínima');
  const inativo = await rv(cM1, espI, 'Q', '101', 'QA inativo', daqui(20));
  ok(inativo.error?.message === 'reserva_espaco_indisponivel', 'espaço inativo recusado no banco');

  // — Configuração: só a equipe altera; vale só para reservas novas —
  for (const [nome, c] of [['morador', cM1], ['Portaria', cPort], ['Conselho', cCons]]) {
    const r = await c.from('spaces').update({ exige_aprovacao: false }).eq('id', espA.id).select();
    ok(!r.data?.length && (await admin.from('spaces').select('exige_aprovacao').eq('id', espA.id).single()).data.exige_aprovacao === true, `${nome} NÃO altera exige_aprovacao`);
  }
  await admin.auth.admin.createUser({ email: email('prov49'), password: SENHA, email_confirm: true }).then(async ({ data }) => admin.from('profiles').insert({ id: data.user.id, email: email('prov49'), name: 'QA provisório49', role: 'MORADOR', bloco: 'Q', unidade: '104', cadastro_validado: false }));
  const cProv = await clientDe(email('prov49'));
  ok(!(await cProv.from('spaces').update({ exige_aprovacao: false }).eq('id', espA.id).select()).data?.length, 'provisório NÃO altera exige_aprovacao');
  ok(!!(await rv(cProv, espB, 'Q', '104', 'QA prov49', daqui(40))).error, 'provisório NÃO cria reserva');
  for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm]]) {
    const novo = nome !== 'ADM';
    const r = await c.from('spaces').update({ exige_aprovacao: novo }).eq('id', espB.id).select();
    ok(r.data?.length === 1 && r.data[0].exige_aprovacao === novo, `${nome} altera exige_aprovacao`);
  }
  // Agora espB exige aprovação (último valor da ADM = false... conferimos o estado real).
  await cSind.from('spaces').update({ exige_aprovacao: true }).eq('id', espB.id);
  ok((await statusDe(auto.data.id)).status === 'APROVADA', 'mudar a configuração NÃO altera reserva já criada');
  const nova = await rv(cM1, espB, 'Q', '101', 'QA depois da mudança', daqui(25), 'APROVADA');
  ok(nova.data?.status === 'PENDENTE', 'após ligar a aprovação, o pedido novo nasce PENDENTE');
  await cSind.from('spaces').update({ exige_aprovacao: false }).eq('id', espB.id);
  ok((await admin.from('audit_logs').select('id').like('acao', '%aprovação da equipe no espaço QA Quadra livre')).data.length >= 3, 'mudança da configuração fica na trilha de auditoria');

  // — Portaria e Conselho: registram em nome do morador; a regra do espaço vale; Conselho não aprova —
  const viaPort = await rv(cPort, espB, 'Q', '102', 'QA via portaria49', daqui(26));
  ok(viaPort.data?.status === 'APROVADA', 'Portaria registra em espaço sem aprovação: sai APROVADA (banco decide)');
  const viaCons = await rv(cCons, espA, 'Q', '102', 'QA via conselho49', daqui(26), 'APROVADA');
  ok(viaCons.data?.status === 'PENDENTE', 'Conselho registra em espaço com aprovação: PENDENTE mesmo pedindo APROVADA');
  ok(!(await cCons.from('reservations').update({ status: 'APROVADA' }).eq('id', viaCons.data.id).select()).data?.length, 'Conselho NÃO aprova');
  ok(!(await cPort.from('spaces').update({ nome: 'QA Quadra livre' }).eq('id', espB.id).select()).data?.length, 'Portaria NÃO edita espaço');

  // — Notificações geradas pelo banco —
  const { data: avisosEq } = await admin.from('notifications').select('titulo,mensagem,perfil_alvo,tipo').eq('titulo', 'Reserva confirmada automaticamente').like('mensagem', 'QA Quadra livre%');
  ok(avisosEq.some((n) => n.mensagem.includes('Este espaço não exige aprovação.') && n.mensagem.includes('(QA morador2)') && n.perfil_alvo === 'SINDICO'), 'auto-aprovada: a equipe recebe aviso informativo');
  ok(!avisosEq.some((n) => n.mensagem.includes('QA via portaria49')), 'sem aviso à equipe quando a própria equipe registrou em nome do morador');
  const { data: avisoUn } = await admin.from('notifications').select('titulo,mensagem,unidade_id_alvo').eq('titulo', 'Reserva confirmada!').like('mensagem', '%QA Quadra livre%');
  ok(avisoUn.some((n) => n.unidade_id_alvo === U['102']), 'a unidade do morador recebe "Reserva confirmada!" (inclusive quando a Portaria registra)');
  ok((await cM2.from('notifications').select('titulo').eq('titulo', 'Reserva confirmada!')).data.length >= 1, 'o morador lê o aviso de confirmação da própria unidade');
  const diaBR = daqui(20).split('-').reverse().join('/');
  ok(!(await cM1.from('notifications').select('mensagem').eq('titulo', 'Reserva confirmada!')).data.some((n) => n.mensagem.includes(diaBR)), 'o aviso de confirmação da Q-102 não aparece para a Q-101');
  ok((await admin.from('audit_logs').select('id').eq('acao', 'Reserva confirmada automaticamente').eq('modulo', 'RESERVAS')).data.length >= 1, 'auditoria: "Reserva confirmada automaticamente"');

  // — Função de disponibilidade —
  const janela = [hojeBR, somaDias(hojeBR, 60)];
  const disp = await cM2.rpc('disponibilidade_reservas', { inicio: janela[0], fim: janela[1] });
  ok(!disp.error && disp.data.length > 0, `morador vê a disponibilidade (${disp.data?.length} linhas)`);
  ok(disp.data.every((l) => Object.keys(l).sort().join() === 'data,espaco_id,ocupado' && l.ocupado === true), 'a resposta só tem espaco_id, data e ocupado');
  const txt = JSON.stringify(disp.data);
  ok(!/QA|Q-?101|morador|PENDENTE|APROVADA|bloco|unidade/i.test(txt), 'nenhum nome, unidade, bloco ou status na resposta (outro morador)');
  ok(disp.data.some((l) => l.espaco_id === espA.id && l.data === daqui(20)) && !disp.data.some((l) => l.espaco_id === espA.id && l.data === daqui(22)), 'pedido PENDENTE conta como ocupado; dia sem pedido, não');
  ok(!(await cM2.from('reservations').select('id').eq('espaco_id', espA.id).eq('data', daqui(21))).data.length, 'a leitura da tabela continua só da própria unidade (política não afrouxada)');
  ok(disp.data.some((l) => l.espaco_id === espA.id && l.data === daqui(21)), 'o dia ocupado por OUTRA unidade (Q-101, dia 21) aparece na função, só como ocupado');
  for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons], ['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm], ['morador1', cM1]]) {
    const r = await c.rpc('disponibilidade_reservas', { inicio: janela[0], fim: janela[1] });
    ok(!r.error && r.data.length > 0, `${nome} chama a função de disponibilidade`);
  }
  const cSem = await (async () => { await criarUsuario(email('semperfil49')); return clientDe(email('semperfil49')); })();
  const rProv = await cProv.rpc('disponibilidade_reservas', { inicio: janela[0], fim: janela[1] });
  ok(!rProv.error && rProv.data.length === 0, 'morador provisório recebe lista vazia');
  const rSem = await cSem.rpc('disponibilidade_reservas', { inicio: janela[0], fim: janela[1] });
  ok(!rSem.error && rSem.data.length === 0, 'conta sem perfil recebe lista vazia');
  const rVis = await anon().rpc('disponibilidade_reservas', { inicio: janela[0], fim: janela[1] });
  ok(!!rVis.error, `visitante sem login: negado (${rVis.error?.code ?? 'sem erro'})`);
  const longe = await cM2.rpc('disponibilidade_reservas', { inicio: somaDias(hojeBR, 300), fim: somaDias(hojeBR, 500) });
  ok(!!longe.error, 'janela além de ~12 meses recusada');
  const longa = await cM2.rpc('disponibilidade_reservas', { inicio: hojeBR, fim: somaDias(hojeBR, 250) });
  ok(!!longa.error, 'consulta de mais de 6 meses recusada');
  const passada = await cM2.rpc('disponibilidade_reservas', { inicio: somaDias(hojeBR, -90), fim: hojeBR });
  ok(!!passada.error, 'janela muito no passado recusada');
  ok(!!(await cM2.rpc('disponibilidade_reservas', { inicio: janela[1], fim: janela[0] })).error, 'fim antes do início recusado');
}

console.log('\n## I3. Bloqueio entre espaços (issue #81 fase 1, migração 0038)');
{
  const base = { descricao: 'QA', capacidade_max: 20, horario_funcionamento: '10h-22h', taxa_limpeza: 0, regras: [] };
  const mk = async (nome, extra = {}) => (await cSind.from('spaces').insert({ ...base, nome, ...extra }).select().single()).data;
  const eA = await mk('QA Bloq A'), eB = await mk('QA Bloq B'), eC = await mk('QA Bloq C'), eD = await mk('QA Bloq D (sem par)');
  const rv = (c, e, bloco, un, nome, dia, status = 'PENDENTE') => c.from('reservations').insert({ espaco_id: e.id, espaco_nome: e.nome, bloco, unidade: un, morador_nome: nome, data: dia, horario_inicio: '12:00', horario_fim: '16:00', convidados_estimados: 5, status }).select().single();
  const pares = async () => (await admin.from('space_blocks').select('espaco_a,espaco_b').in('espaco_a', [eA.id, eB.id, eC.id, eD.id])).data;
  const temPar = async (x, y) => (await pares()).some((p) => (p.espaco_a === x.id && p.espaco_b === y.id) || (p.espaco_a === y.id && p.espaco_b === x.id));
  const BLOQ = 'reserva_dia_indisponivel';
  await admin.auth.admin.createUser({ email: email('prov81'), password: SENHA, email_confirm: true }).then(async ({ data }) => admin.from('profiles').insert({ id: data.user.id, email: email('prov81'), name: 'QA provisório81', role: 'MORADOR', bloco: 'Q', unidade: '104', cadastro_validado: false }));
  const cProv81 = await clientDe(email('prov81'));

  // — Configuração: só a equipe, os dois lados de uma vez —
  for (const [nome, c] of [['morador', cM1], ['Portaria', cPort], ['Conselho', cCons], ['provisório', cProv81], ['visitante', anon()]]) {
    const r = await c.rpc('definir_bloqueios_espaco', { p_espaco_id: eA.id, p_outros: [eB.id] });
    ok(!!r.error && !(await temPar(eA, eB)), `${nome} NÃO chama definir_bloqueios_espaco`);
    const ins = await c.from('space_blocks').insert({ espaco_a: eA.id < eB.id ? eA.id : eB.id, espaco_b: eA.id < eB.id ? eB.id : eA.id });
    ok(!!ins.error && !(await temPar(eA, eB)), `${nome} NÃO grava par direto na tabela`);
    ok(!((await c.from('space_blocks').select('*')).data?.length), `${nome} NÃO lê os pares`);
  }
  const insAdmDireto = await cSind.from('space_blocks').insert({ espaco_a: eA.id < eB.id ? eA.id : eB.id, espaco_b: eA.id < eB.id ? eB.id : eA.id });
  ok(!!insAdmDireto.error, 'nem o Síndico grava par direto: só pela função (uma transação)');
  const r1 = await cSind.rpc('definir_bloqueios_espaco', { p_espaco_id: eA.id, p_outros: [eB.id] });
  ok(!r1.error && (await temPar(eA, eB)), `Síndico marca o par A-B pela função ${r1.error?.message ?? ''}`);
  const lidos = await cSub.from('space_blocks').select('*');
  ok(lidos.data?.length >= 1, 'Subsíndico lê os pares');
  ok((await cAdm.from('space_blocks').select('*')).data?.length >= 1, 'ADM lê os pares');
  const pA = (await pares())[0];
  ok(pA.espaco_a < pA.espaco_b, 'o par fica gravado ordenado (espaco_a < espaco_b)');
  // Simetria: o par aparece olhando de B e some quando desmarca de B.
  const olhandoDeB = (await cSind.from('space_blocks').select('espaco_a,espaco_b').or(`espaco_a.eq.${eB.id},espaco_b.eq.${eB.id}`)).data;
  ok(olhandoDeB.length === 1, 'o bloqueio marcado em A aparece também do lado de B');
  const r2 = await cSub.rpc('definir_bloqueios_espaco', { p_espaco_id: eB.id, p_outros: [] });
  ok(!r2.error && !(await temPar(eA, eB)), 'desmarcar em B remove o bloqueio dos dois lados');
  ok(!(await cAdm.rpc('definir_bloqueios_espaco', { p_espaco_id: eB.id, p_outros: [eA.id] })).error && (await temPar(eA, eB)), 'ADM marca de B para A: vale para A também, sem duplicar');
  ok(!(await cSind.rpc('definir_bloqueios_espaco', { p_espaco_id: eA.id, p_outros: [eB.id, eB.id] })).error && (await pares()).length === 1, 'marcar o mesmo espaço duas vezes não duplica');
  // O banco recusa par duplicado, invertido e o espaço consigo mesmo (mesmo por quem ignora a função).
  const [x, y] = eA.id < eB.id ? [eA.id, eB.id] : [eB.id, eA.id];
  ok(!!(await admin.from('space_blocks').insert({ espaco_a: x, espaco_b: y })).error, 'par duplicado recusado pelo banco');
  ok(!!(await admin.from('space_blocks').insert({ espaco_a: y, espaco_b: x })).error, 'par invertido (B,A) recusado pelo banco');
  ok(!!(await admin.from('space_blocks').insert({ espaco_a: eC.id, espaco_b: eC.id })).error, 'espaço bloqueando a si mesmo recusado pelo banco');
  ok(!!(await cSind.rpc('definir_bloqueios_espaco', { p_espaco_id: eA.id, p_outros: [eA.id] })).error, 'a função recusa o espaço na própria lista');
  ok(!!(await cSind.rpc('definir_bloqueios_espaco', { p_espaco_id: eA.id, p_outros: ['nao-existe'] })).error && (await temPar(eA, eB)), 'a função recusa espaço inexistente e a transação não apaga o par antigo');
  ok((await admin.from('audit_logs').select('id').like('acao', 'Passou a bloquear QA Bloq B no espaço QA Bloq A')).data.length >= 1 && (await admin.from('audit_logs').select('id').like('acao', 'Deixou de bloquear QA Bloq A no espaço QA Bloq B')).data.length >= 1, 'a mudança de bloqueio fica no histórico com frase legível');
  ok(!/Q-?10|morador|@/i.test(JSON.stringify((await admin.from('audit_logs').select('acao,detalhes').like('acao', '%bloquear QA Bloq%')).data)), 'o histórico do bloqueio não traz dado pessoal');

  // — Efeito nas reservas: A–B bloqueados; C só bloqueia se tiver par com B (cadeia) —
  ok(!(await cSind.rpc('definir_bloqueios_espaco', { p_espaco_id: eB.id, p_outros: [eA.id, eC.id] })).error, 'B passa a bloquear A e C (A–B e B–C)');
  const dia = daqui(50);
  const a1 = await rv(cM1, eA, 'Q', '101', 'QA morador1', dia);
  ok(!a1.error, 'Q-101 reserva A no dia D (PENDENTE)');
  const mesmaUn = await rv(cM1, eB, 'Q', '101', 'QA morador1', dia);
  ok(mesmaUn.error?.message === BLOQ, `a MESMA unidade não reserva B no dia da reserva de A (${mesmaUn.error?.message})`);
  const outraUn = await rv(cM2, eB, 'Q', '102', 'QA morador2', dia);
  ok(outraUn.error?.message === BLOQ, 'outra unidade não reserva B no dia da reserva pendente de A');
  for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm], ['Portaria', cPort], ['Conselho', cCons]]) {
    const r = await rv(c, eB, 'Q', '102', `QA ${nome} bloqueio`, dia);
    ok(r.error?.message === BLOQ, `${nome} registrando em nome de morador também é barrado (sem exceção)`);
  }
  const adminAprovada = await rv(cSind, eB, 'Q', '102', 'QA síndico aprovada', dia, 'APROVADA');
  ok(adminAprovada.error?.message === BLOQ, 'Síndico lançando já APROVADA também é barrado');
  ok(!(await rv(cM2, eB, 'Q', '102', 'QA morador2', daqui(51))).error, 'em outro dia, B passa');
  // Sem cadeia: A–B e B–C. A reservado em D (pela Q-101) NÃO impede C em D (pela Q-102).
  const semCadeia = await rv(cM2, eC, 'Q', '102', 'QA morador2', dia);
  ok(!semCadeia.error, 'SEM cadeia: com A–B e B–C, reservar A em D permite reservar C em D');
  ok((await rv(cPort, eB, 'Q', '102', 'QA via portaria', dia)).error?.message === BLOQ, '...mas B fica barrado por A e por C no mesmo dia');
  // Espaço sem par nunca é afetado.
  ok(!(await rv(cM2, eD, 'Q', '102', 'QA morador2', dia)).error, 'espaço sem par não é afetado');

  // — PENDENTE e APROVADA bloqueiam; RECUSADA e CANCELADA liberam —
  const dia2 = daqui(53);
  const ap = await rv(cSind, eA, 'Q', '101', 'QA aprovada A', dia2, 'APROVADA');
  ok(ap.data?.status === 'APROVADA' && (await rv(cM2, eB, 'Q', '102', 'QA morador2', dia2)).error?.message === BLOQ, 'reserva APROVADA em A também bloqueia B');
  ok((await cSind.from('reservations').update({ status: 'CANCELADA' }).eq('id', ap.data.id).select()).data?.length === 1, 'Síndico cancela A');
  const bLibera = await rv(cM2, eB, 'Q', '102', 'QA morador2', dia2);
  ok(!bLibera.error, 'cancelada libera: B passa a ser reservável no dia');
  ok((await cSub.from('reservations').update({ status: 'RECUSADA', motivo_recusa: 'QA' }).eq('id', bLibera.data.id).select()).data?.length === 1, 'Subsíndico recusa B');
  const aDeNovo = await rv(cM1, eA, 'Q', '101', 'QA morador1', dia2);
  ok(!aDeNovo.error, 'recusada libera: A passa a ser reservável no dia');
  const reativa = await cSind.from('reservations').update({ status: 'PENDENTE' }).eq('id', bLibera.data.id).select();
  ok(reativa.error?.message === BLOQ || reativa.error?.message === 'reserva_encerrada', 'reativar a recusada de B com A ocupando o dia é barrado (desde a 0042 a reserva encerrada nem reabre)');
  // Aprovar um pedido que já existia não dispara a checagem (a ocupação não muda).
  ok((await cSind.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA' }).eq('id', aDeNovo.data.id).select()).data?.length === 1, 'aprovar a PENDENTE de A (já existente) continua funcionando');

  // — Reservas existentes continuam valendo ao criar o bloqueio —
  const dia3 = daqui(54);
  await cSind.rpc('definir_bloqueios_espaco', { p_espaco_id: eA.id, p_outros: [] });
  await cSind.rpc('definir_bloqueios_espaco', { p_espaco_id: eB.id, p_outros: [] });
  const exA = await rv(cM1, eA, 'Q', '101', 'QA existente A', dia3);
  const exB = await rv(cM2, eB, 'Q', '102', 'QA existente B', dia3);
  ok(!exA.error && !exB.error, 'sem bloqueio, A e B no mesmo dia coexistem');
  ok(!(await cSind.rpc('definir_bloqueios_espaco', { p_espaco_id: eA.id, p_outros: [eB.id, eC.id] })).error, 'cria o bloqueio A–B e A–C com reservas já existentes');
  const exDepois = (await admin.from('reservations').select('id,status').in('id', [exA.data.id, exB.data.id])).data;
  ok(exDepois.length === 2 && exDepois.every((r) => r.status === 'PENDENTE'), 'as reservas já existentes continuam intactas (nada recusado nem apagado)');
  ok((await rv(cPort, eC, 'Q', '102', 'QA novo C', dia3)).error?.message === BLOQ, 'mas pedido NOVO no dia delas é barrado');

  // — Disponibilidade: o dia fica ocupado sem revelar motivo —
  const hojeBR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const janela = [hojeBR, new Date(Date.parse(hojeBR + 'T12:00:00Z') + 60 * 864e5).toISOString().slice(0, 10)];
  const dia4 = daqui(55);
  const soA = await rv(cM1, eA, 'Q', '101', 'QA só A', dia4);
  const dispM2 = await cM2.rpc('disponibilidade_reservas', { inicio: janela[0], fim: janela[1] });
  const linhaB = dispM2.data.find((l) => l.espaco_id === eB.id && l.data === dia4);
  const linhaDOcupado = dispM2.data.find((l) => l.espaco_id === eA.id && l.data === dia4);
  ok(!soA.error && !!linhaB && linhaB.ocupado === true, 'a função marca B como ocupado no dia da reserva de A (outro morador)');
  ok(Object.keys(linhaB).sort().join() === 'data,espaco_id,ocupado' && JSON.stringify(linhaB).length === JSON.stringify({ ...linhaDOcupado, espaco_id: linhaB.espaco_id }).length, 'a linha de dia bloqueado tem o mesmo formato da de um dia ocupado no próprio espaço');
  ok(dispM2.data.every((l) => Object.keys(l).sort().join() === 'data,espaco_id,ocupado') && !/QA|Q-?101|PENDENTE|APROVADA|bloco|unidade|motivo|bloque/i.test(JSON.stringify(dispM2.data)), 'resposta sem nome, unidade, status nem motivo de bloqueio');
  ok(!dispM2.data.some((l) => l.espaco_id === eD.id && l.data === dia4), 'espaço sem par não aparece ocupado');
  for (const [nome, c] of [['provisório', cProv81]]) ok((await c.rpc('disponibilidade_reservas', { inicio: janela[0], fim: janela[1] })).data?.length === 0, `${nome} segue recebendo lista vazia`);
  ok(!!(await anon().rpc('disponibilidade_reservas', { inicio: janela[0], fim: janela[1] })).error, 'visitante segue negado');

  // — Concorrência: duas reservas simultâneas de espaços que se bloqueiam geram UMA só —
  const rodadas = [];
  for (const n of [60, 61, 62, 63, 64]) {
    const d = daqui(n);
    const r = await Promise.all([rv(cM1, eA, 'Q', '101', `QA corrida A ${n}`, d), rv(cM2, eB, 'Q', '102', `QA corrida B ${n}`, d)]);
    const aceitas = r.filter((x) => !x.error).length;
    const noBanco = (await admin.from('reservations').select('id').in('espaco_id', [eA.id, eB.id]).eq('data', d)).data.length;
    rodadas.push([aceitas, noBanco, r.find((x) => x.error)?.error?.message]);
  }
  ok(rodadas.every(([a, n]) => a === 1 && n === 1), `5 rodadas de 2 pedidos simultâneos (A e B, moradores diferentes): sempre 1 reserva (${JSON.stringify(rodadas.map((r) => r[0]))})`);
  ok(rodadas.every(([, , msg]) => msg === BLOQ), 'o perdedor da corrida recebe o código reserva_dia_indisponivel');
  const d6 = daqui(65);
  const mista = await Promise.all([rv(cM1, eA, 'Q', '101', 'QA corrida 1', d6), rv(cM2, eB, 'Q', '102', 'QA corrida 2', d6), rv(cPort, eC, 'Q', '102', 'QA corrida 3', d6), rv(cSind, eB, 'Q', '102', 'QA corrida 4', d6), rv(cM1, eA, 'Q', '101', 'QA corrida 5', d6), rv(cM2, eB, 'Q', '102', 'QA corrida 6', d6)]);
  const noDia = (await admin.from('reservations').select('espaco_id').in('espaco_id', [eA.id, eB.id, eC.id]).eq('data', d6)).data;
  ok(mista.filter((x) => !x.error).length === noDia.length && new Set(noDia.map((r) => r.espaco_id)).size === noDia.length && !(noDia.some((r) => r.espaco_id === eA.id) && noDia.some((r) => r.espaco_id === eB.id)), `6 pedidos simultâneos (A, B e C): nunca A e B juntos (${noDia.length} reserva(s) no dia)`);

  // — Apagar limpa pares; desativar mantém —
  ok(!(await cSind.rpc('interditar_espaco', { p_espaco_id: eC.id, p_ativo: false })).error && (await temPar(eA, eC)), 'interditar um espaço mantém seus pares (desde a 0041 só pela função)');
  ok(!(await cSind.rpc('interditar_espaco', { p_espaco_id: eC.id, p_ativo: true })).error && (await temPar(eA, eC)), 'reativar mantém a regra');
  const delB = await cSind.from('spaces').delete().eq('id', eB.id).select();
  ok(delB.data?.length === 1 && !(await temPar(eA, eB)), `apagar o espaço B apaga os pares dele (${delB.error?.message ?? 'ok'})`);
  ok((await temPar(eA, eC)) && (await admin.from('reservations').select('espaco_id').eq('id', exB.data.id).single()).data.espaco_id === null, 'o par A–C continua; a reserva do B apagado fica com espaco_id nulo (histórico preservado)');
}

console.log('\n## I4. Valor de uso por faixa de pessoas (issue #81 fase 2, migração 0039)');
{
  const base = { descricao: 'QA', capacidade_max: 30, horario_funcionamento: '10h-22h', taxa_limpeza: 80, regras: [] };
  const { data: sGr } = await cSind.from('spaces').insert({ ...base, nome: 'QA Valor grátis' }).select().single();
  const { data: sFx } = await cSind.from('spaces').insert({ ...base, nome: 'QA Valor faixa' }).select().single();
  const { data: sZero } = await cSind.from('spaces').insert({ ...base, nome: 'QA Valor zero', exige_aprovacao: false }).select().single();
  ok(sGr?.faixa_gratis_ate === null && sGr?.faixa_valor === null, 'espaço novo (e os já existentes) é grátis para qualquer número de pessoas');
  await admin.auth.admin.createUser({ email: email('prov81b'), password: SENHA, email_confirm: true }).then(async ({ data }) => admin.from('profiles').insert({ id: data.user.id, email: email('prov81b'), name: 'QA provisório81b', role: 'MORADOR', bloco: 'Q', unidade: '104', cadastro_validado: false }));
  const cProvB = await clientDe(email('prov81b'));
  const lerSp = async (id) => (await admin.from('spaces').select('faixa_gratis_ate,faixa_valor,taxa_limpeza,capacidade_max').eq('id', id).single()).data;

  // — Só a equipe edita a faixa —
  for (const [nome, c] of [['morador', cM1], ['Portaria', cPort], ['Conselho', cCons], ['provisório', cProvB], ['visitante', anon()]]) {
    const r = await c.from('spaces').update({ faixa_gratis_ate: 10, faixa_valor: 150 }).eq('id', sFx.id).select();
    ok(!r.data?.length && (await lerSp(sFx.id)).faixa_valor === null, `${nome} NÃO altera a faixa do espaço`);
  }
  for (const [nome, c] of [['Subsíndico', cSub], ['ADM', cAdm], ['Síndico', cSind]]) {
    const r = await c.from('spaces').update({ faixa_gratis_ate: 10, faixa_valor: 150 }).eq('id', sFx.id).select();
    ok(r.data?.length === 1 && Number(r.data[0].faixa_valor) === 150, `${nome} define "grátis até 10 e R$ 150"`);
  }
  // — Validações do banco —
  const tenta = async (patch) => (await cSind.from('spaces').update(patch).eq('id', sGr.id).select()).error;
  ok(!!(await tenta({ faixa_gratis_ate: 10 })), 'só o limite, sem valor: recusado');
  ok(!!(await tenta({ faixa_valor: 150 })), 'só o valor, sem limite: recusado');
  ok(!!(await tenta({ faixa_gratis_ate: 10, faixa_valor: 0 })), 'valor zero recusado');
  ok(!!(await tenta({ faixa_gratis_ate: 10, faixa_valor: -5 })), 'valor negativo recusado');
  ok(!!(await tenta({ faixa_gratis_ate: -1, faixa_valor: 50 })), 'limite negativo recusado');
  ok(!!(await tenta({ faixa_gratis_ate: 30, faixa_valor: 50 })), 'limite igual à capacidade recusado');
  ok(!!(await tenta({ faixa_gratis_ate: 45, faixa_valor: 50 })), 'limite maior que a capacidade recusado');
  ok(!(await tenta({ faixa_gratis_ate: 29, faixa_valor: 50 })), 'limite logo abaixo da capacidade aceito');
  ok(!(await tenta({ faixa_gratis_ate: null, faixa_valor: null })), 'voltar a "grátis" (limite e valor nulos) aceito');
  ok(!!(await cSind.from('spaces').update({ capacidade_max: 10 }).eq('id', sFx.id).select()).error && (await lerSp(sFx.id)).capacidade_max === 30, 'reduzir a capacidade para o limite grátis ou menos é recusado');
  ok(!(await cSind.from('spaces').update({ faixa_gratis_ate: 0, faixa_valor: 90 }).eq('id', sZero.id).select()).error, 'limite 0 (cobra de todos) aceito');

  // — Função única da regra —
  const vr = async (c, e, n) => (await c.rpc('valor_reserva', { p_espaco_id: e.id, p_pessoas: n })).data;
  ok(Number(await vr(cM1, sFx, 10)) === 0, 'valor_reserva: 10 pessoas na faixa "até 10" = 0 (até X é inclusivo)');
  ok(Number(await vr(cM1, sFx, 11)) === 150, 'valor_reserva: 11 pessoas = R$ 150 (valor fixo)');
  ok(Number(await vr(cM1, sFx, 30)) === 150, 'valor_reserva: 30 pessoas = R$ 150 (não é por pessoa)');
  ok(Number(await vr(cM1, sGr, 30)) === 0, 'valor_reserva: espaço grátis = 0 para qualquer número');
  ok(Number(await vr(cM1, sZero, 1)) === 90, 'valor_reserva: X = 0 cobra de todos (1 pessoa = R$ 90)');
  ok((await vr(cM1, { id: 'nao-existe' }, 5)) === null, 'valor_reserva: espaço inexistente = nulo');
  ok(!!(await anon().rpc('valor_reserva', { p_espaco_id: sFx.id, p_pessoas: 5 })).error, 'visitante NÃO chama valor_reserva');
  const cSemPerf = await (async () => { await criarUsuario(email('semperfil81')); return clientDe(email('semperfil81')); })();
  ok((await cSemPerf.rpc('valor_reserva', { p_espaco_id: sFx.id, p_pessoas: 20 })).data === null, 'conta sem perfil recebe nulo');

  // — Gravado pelo banco; o que o cliente manda é ignorado —
  const rvp = (c, e, bloco, un, nome, dia, pessoas, extra = {}) => c.from('reservations').insert({ espaco_id: e.id, espaco_nome: e.nome, bloco, unidade: un, morador_nome: nome, data: dia, horario_inicio: '12:00', horario_fim: '16:00', convidados_estimados: pessoas, status: 'PENDENTE', ...extra }).select().single();
  const g10 = await rvp(cM1, sFx, 'Q', '101', 'QA morador1', daqui(70), 10);
  const g11 = await rvp(cM2, sFx, 'Q', '102', 'QA morador2', daqui(71), 11);
  ok(Number(g10.data?.valor_uso) === 0 && Number(g10.data?.taxa_higienizacao) === 80, '10 pessoas grava valor 0 e a higienização do espaço (R$ 80)');
  ok(Number(g11.data?.valor_uso) === 150 && g11.data?.convidados_estimados === 11, '11 pessoas grava R$ 150 e o número de pessoas');
  ok(Number((await rvp(cM1, sGr, 'Q', '101', 'QA morador1', daqui(70), 30)).data?.valor_uso) === 0, 'espaço sem faixa grava 0 para 30 pessoas');
  for (const [nome, c, bl, un, dia] of [['morador', cM1, 'Q', '101', 72], ['Portaria', cPort, 'Q', '102', 73], ['Conselho', cCons, 'Q', '102', 74], ['Síndico', cSind, 'Q', '102', 75], ['ADM', cAdm, 'Q', '102', 76]]) {
    const r = await rvp(c, sFx, bl, un, `QA forja ${nome}`, daqui(dia), 12, { valor_uso: 0, taxa_higienizacao: 999 });
    ok(!r.error && Number(r.data.valor_uso) === 150 && Number(r.data.taxa_higienizacao) === 80, `${nome} manda valor_uso 0 e taxa 999: o banco ignora e grava 150 e 80`);
  }
  const forjaAlta = await rvp(cM2, sGr, 'Q', '102', 'QA forja alta', daqui(77), 5, { valor_uso: 5000 });
  ok(Number(forjaAlta.data?.valor_uso) === 0, 'valor inflado enviado em espaço grátis também é ignorado');
  // Pessoas inválidas (declarar 0 escaparia da faixa paga).
  for (const n of [0, -3, 31]) ok(!!(await rvp(cM2, sFx, 'Q', '102', 'QA invalida', daqui(78), n)).error, `${n} pessoas recusado no banco (entre 1 e a capacidade)`);
  const z = await rvp(cPort, sZero, 'Q', '102', 'QA via portaria zero', daqui(79), 1);
  ok(Number(z.data?.valor_uso) === 90 && z.data?.status === 'APROVADA', 'X = 0: a reserva de 1 pessoa grava R$ 90 (e confirma na hora neste espaço)');

  // — Leitura: quem já lê a reserva vê o valor —
  ok(Number((await cM1.from('reservations').select('valor_uso').eq('id', g10.data.id).single()).data?.valor_uso) === 0, 'o morador lê o valor da reserva da própria unidade');
  ok(!(await cM1.from('reservations').select('valor_uso').eq('id', g11.data.id)).data?.length, 'o morador NÃO lê o valor da reserva de outra unidade');
  for (const [nome, c] of [['Portaria', cPort], ['Conselho', cCons]]) ok(Number((await c.from('reservations').select('valor_uso').eq('id', g11.data.id).single()).data?.valor_uso) === 150, `${nome} lê o valor das reservas (já lê as reservas)`);

  // — Imutável depois de criada —
  const lerRv = async (id) => (await admin.from('reservations').select('valor_uso,taxa_higienizacao,convidados_estimados,data,espaco_id,status').eq('id', id).single()).data;
  const antes = await lerRv(g11.data.id);
  for (const [campo, valor] of [['valor_uso', 0], ['taxa_higienizacao', 0], ['convidados_estimados', 1], ['data', daqui(90)], ['espaco_id', sGr.id]]) {
    for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm]]) {
      const r = await c.from('reservations').update({ [campo]: valor }).eq('id', g11.data.id).select();
      if (!r.error && r.data?.length) ok(false, `${nome} alterou ${campo}`);
    }
    ok(JSON.stringify(await lerRv(g11.data.id)) === JSON.stringify(antes), `alterar ${campo} é negado à gestão (reserva intacta)`);
  }
  for (const [nome, c] of [['morador', cM2], ['Portaria', cPort], ['Conselho', cCons]]) {
    await c.from('reservations').update({ valor_uso: 0 }).eq('id', g11.data.id);
    ok(Number((await lerRv(g11.data.id)).valor_uso) === 150, `${nome} NÃO altera o valor`);
  }
  ok((await cSind.from('reservations').update({ status: 'APROVADA', avaliado_por: 'QA' }).eq('id', g11.data.id).select()).data?.length === 1, 'aprovar (mudar status) continua permitido');
  // — Mudar a tabela não altera reservas antigas —
  await cSind.from('spaces').update({ faixa_gratis_ate: 20, faixa_valor: 400, taxa_limpeza: 200 }).eq('id', sFx.id);
  const depois = await lerRv(g11.data.id);
  ok(Number(depois.valor_uso) === 150 && Number(depois.taxa_higienizacao) === 80, 'mudar a faixa e a higienização do espaço NÃO altera a reserva já criada');
  const nova = await rvp(cM1, sFx, 'Q', '101', 'QA após mudança', daqui(80), 11);
  ok(Number(nova.data?.valor_uso) === 0 && Number(nova.data?.taxa_higienizacao) === 200, 'a reserva NOVA já usa a tabela nova (11 pessoas agora é grátis: até 20)');
  // Apagar o espaço continua funcionando com o valor protegido (espaco_id vira nulo).
  const { data: sTmp } = await cSind.from('spaces').insert({ ...base, nome: 'QA Valor efêmero', faixa_gratis_ate: 5, faixa_valor: 20 }).select().single();
  const tmp = await rvp(cM1, sTmp, 'Q', '101', 'QA efêmera', daqui(81), 8);
  const del = await cSind.from('spaces').delete().eq('id', sTmp.id).select();
  ok(del.data?.length === 1 && (await lerRv(tmp.data.id)).espaco_id === null && Number((await lerRv(tmp.data.id)).valor_uso) === 20, 'apagar o espaço mantém a reserva com o valor gravado (espaco_id nulo)');

  // — Aviso à equipe traz o valor só quando há —
  await rvp(cM1, sZero, 'Q', '101', 'QA morador1', daqui(84), 2);
  const { data: avisos } = await admin.from('notifications').select('mensagem').eq('titulo', 'Reserva confirmada automaticamente').like('mensagem', 'QA Valor zero%');
  ok(avisos.some((n) => n.mensagem.includes('Valor de uso: R$ 90,00.') && !n.mensagem.includes('acima de')), 'aviso da confirmação automática traz "Valor de uso: R$ 90,00." (X = 0: sem "acima de")');
  const { data: sAuto } = await cSind.from('spaces').insert({ ...base, nome: 'QA Valor auto', exige_aprovacao: false, faixa_gratis_ate: 10, faixa_valor: 1234.5 }).select().single();
  await rvp(cM1, sAuto, 'Q', '101', 'QA morador1', daqui(82), 25);
  await rvp(cM2, sAuto, 'Q', '102', 'QA morador2', daqui(83), 4);
  const { data: av2 } = await admin.from('notifications').select('mensagem').eq('titulo', 'Reserva confirmada automaticamente').like('mensagem', 'QA Valor auto%');
  ok(av2.some((n) => n.mensagem.includes('Valor de uso: R$ 1.234,50 (acima de 10 pessoas).')), 'aviso com valor com milhar e faixa: "R$ 1.234,50 (acima de 10 pessoas)."');
  ok(av2.some((n) => n.mensagem.includes('(QA morador2)') && !n.mensagem.includes('Valor de uso')), 'reserva grátis: aviso sem a frase do valor (texto igual ao de hoje)');
}

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

console.log('\n## J4. Morador remove veículo da própria unidade e multa sem valor negativo (issue #51) — exigem as migrações 0035 e 0036');
{
  const existe = async (placa) => !!(await admin.from('vehicles').select('id').eq('placa', placa).maybeSingle()).data;
  const rotulos = async (frag) => (await admin.from('audit_logs').select('acao,usuario_role,detalhes').like('acao', frag)).data ?? [];
  // Veículos descartáveis (cada teste apaga o dele): R1 da Q-102 (morador2), R2 da Q-101 (morador1), RV visitante da Q-102.
  const novoVeic = (placa, extra = {}) => admin.from('vehicles').insert(veic(placa, extra));
  await novoVeic('QAR1E01'); await novoVeic('QAR2E02', { unidade: '101', unit_id: U['101'] });
  await novoVeic('QAR3E03', { status: 'VISITANTE', vaga: 'Visitante' });
  // 1) morador remove o PRÓPRIO veículo; outro morador e a regra da unidade
  const outro = await cM1.from('vehicles').delete().eq('placa', 'QAR1E01').select('id');
  ok(!outro.data?.length && (await existe('QAR1E01')), '[0036] morador1 (Q-101) NÃO remove veículo da Q-102 (0 linhas)');
  const cima = await cM2.from('vehicles').delete().eq('placa', 'QAR2E02').select('id');
  ok(!cima.data?.length && (await existe('QAR2E02')), '[0036] morador2 (Q-102) NÃO remove veículo da Q-101 (0 linhas)');
  const proprio = await cM2.from('vehicles').delete().eq('placa', 'QAR1E01').select('id');
  ok(proprio.data?.length === 1 && !(await existe('QAR1E01')), '[0036] morador2 remove o veículo da PRÓPRIA unidade');
  // 2) histórico gravado pelo banco, em frase legível e sem placa
  const logs = (await rotulos('Removeu um veículo da unidade 102 (Bloco Q)%')).filter((l) => l.usuario_role === 'MORADOR');
  ok(logs.length === 1 && logs[0].acao === 'Removeu um veículo da unidade 102 (Bloco Q)' && !/QAR1E01/.test(JSON.stringify(logs[0])), `[0036] remoção grava histórico legível, sem placa em lugar nenhum ("${logs[0]?.acao}")`);
  ok(descreverAuditoria(logs[0]?.acao ?? '', logs[0]?.detalhes ?? {}).frase === 'Removeu um veículo da unidade 102 (Bloco Q).', '[0036] a tela de Relatórios mostra a frase do histórico');
  // 3) veículo de VISITANTE da própria unidade: a TELA esconde o botão; o que o BANCO permite é só informado
  const visit = await cM2.from('vehicles').delete().eq('placa', 'QAR3E03').select('id');
  ok(true, `[informativo] morador2 apagar VISITANTE da própria unidade por API: banco ${visit.data?.length ? 'PERMITE (a regra é só da tela; lacuna a decidir)' : 'recusa'}`);
  await admin.from('vehicles').delete().eq('placa', 'QAR3E03');
  // 4) demais perfis
  const prov = await cProv.from('vehicles').delete().eq('placa', 'QAP0V04').select('id');
  ok(!prov.data?.length && (await existe('QAP0V04')), '[0036] morador provisório NÃO remove (bloqueado)');
  await novoVeic('QAR4E04');
  const cons = await cCons.from('vehicles').delete().eq('placa', 'QAR4E04').select('id');
  ok(!cons.data?.length && (await existe('QAR4E04')), '[0036] Conselho lê mas NÃO remove veículo (0 linhas)');
  ok((await cCons.from('vehicles').select('id').eq('placa', 'QAR4E04')).data?.length === 1, '[0036] Conselho continua lendo o veículo');
  ok((await cPort.from('vehicles').select('id').eq('placa', 'QAR4E04')).data?.length === 1, '[0036] Portaria continua lendo o veículo');
  const vis = await anon().from('vehicles').delete().eq('placa', 'QAR4E04').select('id');
  ok(!vis.data?.length && (await existe('QAR4E04')), '[0036] visitante sem login NÃO remove');
  const port = await cPort.from('vehicles').delete().eq('placa', 'QAR4E04').select('id');
  ok(true, `[informativo] Portaria apagar veículo por API: banco ${port.data?.length ? 'PERMITE (policy vehicles_delete inclui PORTARIA; a tela não mostra o botão)' : 'recusa'}`);
  if (!port.data?.length) await admin.from('vehicles').delete().eq('placa', 'QAR4E04');
  for (const [nome, c, i] of [['Síndico', cSind, 5], ['Subsíndico', cSub, 6], ['ADM', cAdm, 7]]) {
    const placa = `QAR${i}E0${i}`;
    await novoVeic(placa);
    const r = await c.from('vehicles').delete().eq('placa', placa).select('id');
    ok(r.data?.length === 1 && !(await existe(placa)), `[0036] ${nome} remove veículo de qualquer unidade`);
  }
  const todos = (await rotulos('Removeu um veículo da unidade 102 (Bloco Q)%')).filter((l) => l.usuario_role !== 'MORADOR');
  ok(todos.length >= 3 && todos.every((l) => !/QAR\dE0\d/.test(JSON.stringify(l))), '[0036] remoções da equipe também entram no histórico, sem placa');

  // 5) multa sem valor negativo (CHECK valor >= 0, 0035)
  const fine = (n, valor, tipo = 'MULTA') => ({ numero_protocolo: `QA-V${n}`, bloco: 'Q', unidade: '101', unit_id: U['101'], morador_nome: 'QA morador1', data_infracao: hoje, prazo_recurso_data: daqui(10), artigo_regimento: 'Art. 1', descricao_infracao: 'QA', valor, tipo });
  let n = 0;
  for (const [nome, c] of [['Síndico', cSind], ['Subsíndico', cSub], ['ADM', cAdm], ['chave de serviço', admin]]) {
    const neg = await c.from('fines').insert(fine(++n, -50)).select('id');
    ok(neg.error?.code === '23514' && !neg.data?.length, `[0035] ${nome}: multa com valor -50 recusada pelo banco (${neg.error?.code ?? 'sem erro'})`);
    const frac = await c.from('fines').insert(fine(++n, -0.01)).select('id');
    ok(frac.error?.code === '23514', `[0035] ${nome}: valor -0,01 recusado`);
    const zero = await c.from('fines').insert(fine(++n, 0, 'ADVERTENCIA')).select('id');
    ok(!zero.error && zero.data?.length === 1, `[0035] ${nome}: advertência com valor 0 aceita`);
    const pos = await c.from('fines').insert(fine(++n, 350.5)).select('id');
    ok(!pos.error && pos.data?.length === 1, `[0035] ${nome}: multa de R$ 350,50 aceita`);
  }
  // Atualizar para negativo também é recusado (a restrição vale para update).
  const upd = await cSind.from('fines').update({ valor: -1 }).eq('numero_protocolo', 'QA-V3').select('id');
  ok(!!upd.error, '[0035] Síndico NÃO altera uma multa para valor negativo');
  const { data: nulo } = await admin.from('fines').select('numero_protocolo').like('numero_protocolo', 'QA-V%').lt('valor', 0);
  ok(!nulo?.length, '[0035] nenhuma multa com valor negativo ficou gravada');
  // Regra de tela (valor 0 em Multa Financeira) vive no formulário; o banco aceita 0 de propósito (advertência).
  ok(!(await admin.from('fines').insert(fine(++n, 0, 'MULTA'))).error, '[0035] banco aceita valor 0 (a tela exige maior que zero em Multa Financeira)');
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
for (const t of ['profiles', 'units', 'vehicles', 'fines', 'spaces', 'reservations', 'documents', 'notices', 'notifications', 'audit_logs', 'pending_invites', 'autocadastros', 'autocadastro_config', 'zelador', 'portal_administradora', 'notification_reads', 'unit_documentos']) {
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
    igual(descreverAuditoria('Reserva confirmada automaticamente', { reservationId: 'x', espaco: 'Quadra', unidade: '5', bloco: 'B' }).frase, 'Reserva de Quadra, unidade 5, bloco B: confirmada automaticamente (o espaço não exige aprovação).', 'reserva confirmada pelo banco vira frase');
    igual(descreverAuditoria('Anulou multa NOT-2026/004', { fineId: 'x', protocolo: 'NOT-2026/004', unidade: '101', bloco: 'A', statusAnterior: 'PENDENTE_CIENCIA', motivo: 'Unidade errada' }).frase, 'Multa NOT-2026/004 (unidade 101, bloco A) anulada. Motivo: Unidade errada', 'anulação vira frase');
    igual(descreverAuditoria('Anulou multa NOT-2026/004', { fineId: 'x', protocolo: 'NOT-2026/004', unidade: '101', bloco: 'A', motivo: 'Unidade errada' }).tecnicos.map((t) => t.chave).join(), 'fineId', 'id da multa só em detalhes técnicos');
    ok(/^Multa NOT-2026\/005 \(unidade 7, bloco B, multa de R\$\s350,00, estava em recurso\) apagada\.$/.test(descreverAuditoria('Apagou multa NOT-2026/005', { fineId: 'x', protocolo: 'NOT-2026/005', unidade: '7', bloco: 'B', tipo: 'MULTA', valor: 350, statusAnterior: 'EM_RECURSO' }).frase), 'exclusão vira frase com tipo, valor e estado');
    igual(descreverAuditoria('Apagou multa NOT-2026/006', { protocolo: 'NOT-2026/006', unidade: '7', bloco: 'B', tipo: 'ADVERTENCIA', valor: 0, statusAnterior: 'PENDENTE_CIENCIA' }).frase, 'Multa NOT-2026/006 (unidade 7, bloco B, advertência, estava aguardando ciência) apagada.', 'exclusão de advertência não mostra valor');
  }
}

await rodarTransferirCargo({ unidadeSemMorador: U['104'] });
await rodarZelador({ U });
await rodarHierarquia();

await limparQA();
resumo();
