// Zera e recria a base de TESTE (projeto harmony-staging).
//
//   node scripts/seed-staging.mjs
//
// Lê as credenciais de .env.staging.local e se recusa a rodar se elas não
// forem do projeto de staging — este script apaga TODOS os usuários e dados.
// Todas as contas criadas usam a senha 123456.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'yusmuzifhhlowuqtcnid';
const SENHA = '123456';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.staging.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(STAGING_REF)) {
  console.error(`Abortado: NEXT_PUBLIC_SUPABASE_URL não é o projeto de staging (${STAGING_REF}).`);
  process.exit(1);
}

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const falhar = (etapa, error) => {
  if (error) {
    console.error(`Erro em ${etapa}: ${error.message}`);
    process.exit(1);
  }
};

// ── 1) Zera tudo ──
// Ordem respeita as FKs (filhos antes de units). id "nunca igual" = todas as linhas.
const TABELAS = [
  'autocadastros', 'reservations', 'fines', 'vehicles', 'spaces', 'documents', 'document_links',
  'notices', 'notifications', 'audit_logs', 'cargo_transferencias', 'pending_invites', 'units',
];
for (const t of TABELAS) {
  const { error } = await admin.from(t).delete().not('id', 'is', null);
  falhar(`limpar ${t}`, error);
}
const { data: lista, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
falhar('listar usuários', listErr);
for (const u of lista.users) {
  await admin.from('profiles').delete().eq('id', u.id);
  const { error } = await admin.auth.admin.deleteUser(u.id);
  falhar(`apagar ${u.email}`, error);
}
await admin.from('zelador').update({ nome: '', telefone: '', horario_atendimento: '', observacoes: null }).eq('id', 1);
await admin.from('portal_administradora').update({ descricao: '', link_externo: '' }).eq('id', 1);
await admin.from('autocadastro_config').update({ aberto: true }).eq('id', 1);

// ── 2) Unidades ──
const unidades = [
  { bloco: 'A', numero: '101', nome: 'Morador Proprietário', tipo: 'PROPRIETARIO', email: 'morador@staging.test', tel: '(11) 91111-1111' },
  { bloco: 'A', numero: '102', nome: 'Morador Inquilino', tipo: 'INQUILINO', email: 'inquilino@staging.test', tel: '(11) 92222-2222' },
  { bloco: 'A', numero: '103' },
  { bloco: 'A', numero: '104' },
  { bloco: 'B', numero: '101' },
  { bloco: 'B', numero: '102' },
];
const { data: units, error: unitErr } = await admin.from('units').insert(
  unidades.map((u) => ({
    bloco: u.bloco,
    numero: u.numero,
    proprietario_nome: u.tipo === 'INQUILINO' ? 'Proprietário Ausente' : (u.nome ?? ''),
    proprietario_telefone: u.tipo === 'INQUILINO' ? '(11) 90000-0000' : (u.tel ?? ''),
    proprietario_email: u.tipo === 'INQUILINO' ? 'dono@staging.test' : (u.email ?? ''),
    tipo_ocupacao: u.tipo ?? 'DESOCUPADO',
    moradores: u.nome
      ? [
          { nome: u.nome, tipo: u.tipo === 'INQUILINO' ? 'INQUILINO' : 'TITULAR', telefone: u.tel, email: u.email },
          { nome: `Dependente de ${u.nome.split(' ')[1]}`, tipo: 'DEPENDENTE', telefone: '' },
        ]
      : [],
    vagas_garagem: u.nome ? [`${u.bloco}${u.numero}`] : [],
    animais: '',
  }))
).select();
falhar('criar unidades', unitErr);
const unitDe = (bloco, numero) => units.find((u) => u.bloco === bloco && u.numero === numero);

// Documento do titular (issue #67): fica em tabela própria, só a gestão e o próprio morador leem.
// Valores fictícios, em A-101 (morador) e A-102 (inquilino): cada um só deve ler o da própria unidade.
// Os ids dos moradores são dados pelo banco (gatilho de units).
for (const [bloco, numero, doc] of [['A', '101', '111.222.333-96'], ['A', '102', '222.333.444-05']]) {
  const u = unitDe(bloco, numero);
  const { error } = await admin.from('unit_documentos').insert({ unit_id: u.id, morador_id: u.moradores[0].id, documento: doc });
  falhar(`documento fictício ${bloco}-${numero}`, error);
}

// ── 3) Usuários (um por perfil) ──
const usuarios = [
  { email: 'sindico@staging.test', name: 'Síndico Teste', role: 'SINDICO' },
  { email: 'subsindico@staging.test', name: 'Subsíndico Teste', role: 'SUBSINDICO' },
  { email: 'adm@staging.test', name: 'Administradora Teste', role: 'ADM' },
  { email: 'portaria@staging.test', name: 'Portaria Teste', role: 'PORTARIA' },
  { email: 'conselho@staging.test', name: 'Conselho Teste', role: 'CONSELHO' },
  { email: 'morador@staging.test', name: 'Morador Proprietário', role: 'MORADOR', bloco: 'A', unidade: '101', telefone: '(11) 91111-1111' },
  { email: 'inquilino@staging.test', name: 'Morador Inquilino', role: 'MORADOR', bloco: 'A', unidade: '102', telefone: '(11) 92222-2222' },
  // Transferir cargo (issue #53): segundos titulares (Conselho e Portaria admitem vários) e candidatos a assumir.
  // conselho2 mora em B-102: ao perder o cargo vira Morador VALIDADO. Os demais, sem unidade, viram provisórios.
  { email: 'conselho2@staging.test', name: 'Conselho Dois', role: 'CONSELHO', bloco: 'B', unidade: '102', telefone: '(11) 93333-0002' },
  { email: 'portaria2@staging.test', name: 'Portaria Dois', role: 'PORTARIA' },
  { email: 'candidato1@staging.test', name: 'Candidato Um', role: 'MORADOR', bloco: 'B', unidade: '101', telefone: '(11) 94444-0001' },
  { email: 'candidato2@staging.test', name: 'Candidato Dois', role: 'MORADOR' },
  // Provisório (autocadastro aguardando validação): a tela NÃO o oferece como destino de cargo.
  { email: 'provisorio@staging.test', name: 'Morador Provisório', role: 'MORADOR', validado: false },
];
for (const u of usuarios) {
  const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: SENHA, email_confirm: true });
  falhar(`criar ${u.email}`, error);
  const { error: pErr } = await admin.from('profiles').insert({
    id: data.user.id, email: u.email, name: u.name, role: u.role,
    bloco: u.bloco ?? null, unidade: u.unidade ?? null, telefone: u.telefone ?? null,
    cadastro_validado: u.validado ?? true,
  });
  falhar(`perfil ${u.email}`, pErr);
  if (u.bloco) {
    const { error: lErr } = await admin.from('units')
      .update({ usuario_id: data.user.id, status_convite: 'ATIVO' })
      .eq('id', unitDe(u.bloco, u.unidade).id);
    falhar(`vincular ${u.email}`, lErr);
  }
}

// ── 3b) Um destino NOVO por convite: transferência pendente da Portaria Dois para uma pessoa que ainda não tem conta ──
// O cargo só vale quando ela aceitar o convite (definir a senha pelo link). Serve para testar "Cancelar transferência".
{
  const { data: ex } = await admin.from('profiles').select('id').eq('email', 'adm@staging.test').single();
  const { data: orig } = await admin.from('profiles').select('id').eq('email', 'portaria2@staging.test').single();
  const origem = process.env.SITE_URL ?? 'http://localhost:3000';
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite', email: 'novo.porteiro@staging.test', options: { data: { name: 'Novo Porteiro' }, redirectTo: `${origem}/definir-senha` },
  });
  falhar('link do convite de cargo', linkErr);
  const url = `${origem}/definir-senha?token_hash=${link.properties.hashed_token}&type=${link.properties.verification_type}`;
  const { data: res, error: rpcErr } = await admin.rpc('iniciar_transferencia_cargo', {
    p_executor: ex.id, p_cargo: 'PORTARIA', p_origem: orig.id, p_destino_id: link.user.id,
    p_nome: 'Novo Porteiro', p_email: 'novo.porteiro@staging.test', p_telefone: '(11) 95555-0001', p_link: url,
  });
  falhar('transferência pendente do seed', rpcErr ?? (res?.ok ? null : new Error(res?.codigo)));
}

// ── 4) Veículos, espaço e aviso ──
const a101 = unitDe('A', '101');
const a102 = unitDe('A', '102');
falhar('veículos', (await admin.from('vehicles').insert([
  { placa: 'STG1A01', marca: 'Volkswagen', modelo: 'Gol', cor: 'Prata', bloco: 'A', unidade: '101', vaga: 'A101', proprietario_nome: 'Morador Proprietário', telefone_contato: '(11) 91111-1111', unit_id: a101.id, tipo_veiculo: 'CARRO' },
  { placa: 'STG3C03', marca: 'Honda', modelo: 'CG 160', cor: 'Vermelha', bloco: 'A', unidade: '101', vaga: 'A101-M', proprietario_nome: 'Morador Proprietário', telefone_contato: '(11) 91111-1111', unit_id: a101.id, tipo_veiculo: 'MOTO' },
  { placa: 'STG2B02', marca: 'Honda', modelo: 'Civic', cor: 'Preto', bloco: 'A', unidade: '102', vaga: 'A102', proprietario_nome: 'Morador Inquilino', telefone_contato: '(11) 92222-2222', unit_id: a102.id, tipo_veiculo: 'CARRO' },
  // Tipo Outro (o mesmo valor que a migração deu aos veículos antigos).
  { placa: 'STG5E05', marca: 'Fiat', modelo: 'Argo', cor: 'Branco', bloco: 'A', unidade: '101', vaga: 'A101-C', proprietario_nome: 'Morador Proprietário', telefone_contato: '(11) 91111-1111', unit_id: a101.id, tipo_veiculo: 'CARRO' },
  { placa: 'STG4D04', marca: 'Caloi', modelo: 'Elétrica', cor: 'Cinza', bloco: 'A', unidade: '102', vaga: 'A102-B', proprietario_nome: 'Morador Inquilino', telefone_contato: '(11) 92222-2222', unit_id: a102.id , tipo_veiculo: 'OUTRO' },
])).error);
// Visitante da unidade 101 (insert à parte: as outras linhas não trazem "status", que fica no padrão ATIVO).
// O morador não edita veículo de visitante: o status é só da equipe.
falhar('veículo visitante', (await admin.from('vehicles').insert(
  { placa: 'STG6F06', marca: 'Renault', modelo: 'Kwid', cor: 'Azul', bloco: 'A', unidade: '101', vaga: 'Visitante', proprietario_nome: 'Visita do 101', telefone_contato: '(11) 93333-3333', unit_id: a101.id, tipo_veiculo: 'CARRO', status: 'VISITANTE' },
)).error);
// Espaços: o Salão exige aprovação da equipe (padrão) e cobra por faixa (grátis até 10 pessoas, acima R$ 150,00);
// a Churrasqueira confirma na hora e é grátis; a Quadra está em manutenção; a Sala de Jogos confirma na hora, é grátis e
// NÃO tem bloqueio. Salão e Churrasqueira se bloqueiam (par criado mais abaixo, depois das reservas).
const { data: espacos, error: espErr } = await admin.from('spaces').insert([
  { nome: 'Salão de Festas', descricao: 'Salão para até 50 pessoas', capacidade_max: 50, horario_funcionamento: '10h às 22h', taxa_limpeza: 150, regras: ['Silêncio após as 22h'], ativo: true, exige_aprovacao: true, faixa_gratis_ate: 10, faixa_valor: 150 },
  { nome: 'Churrasqueira', descricao: 'Churrasqueira coberta para até 20 pessoas', capacidade_max: 20, horario_funcionamento: '10h às 22h', taxa_limpeza: 0, regras: ['Limpar após o uso'], ativo: true, exige_aprovacao: false },
  { nome: 'Sala de Jogos', descricao: 'Sala com mesa de sinuca e pebolim para até 15 pessoas', capacidade_max: 15, horario_funcionamento: '10h às 22h', taxa_limpeza: 0, regras: ['Desligar as luzes ao sair'], ativo: true, exige_aprovacao: false },
  { nome: 'Quadra Poliesportiva', descricao: 'Quadra em manutenção para teste do aviso', capacidade_max: 30, horario_funcionamento: '08h às 20h', taxa_limpeza: 0, regras: [], ativo: false, exige_aprovacao: true },
]).select();
falhar('espaços', espErr);
const salao = espacos.find((e) => e.nome === 'Salão de Festas');
const churras = espacos.find((e) => e.nome === 'Churrasqueira');

// Reservas em dias diferentes (data de Brasília; a seed roda sem usuário, então o banco não mexe no status).
// Salão: um pedido aguardando (A-101, dia 5) e uma aprovada (A-102, dia 9). Churrasqueira: confirmada automaticamente
// (A-102, dia 7) e (A-101, dia 12). NENHUM dia tem reserva dos dois espaços: Salão e Churrasqueira se bloqueiam, e a seed
// grava pelo service role (que ignora o gatilho de bloqueio), então um par no mesmo dia criaria uma situação que o
// sistema não permite (um pedido aguardando de um lado e uma reserva aprovada do outro). Para testar "espaços diferentes
// no mesmo dia" use a Sala de Jogos, que não bloqueia ninguém.
const hojeBR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const diaBR = (n) => new Date(Date.parse(hojeBR + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const reserva = (e, bloco, un, nome, dia, status, extra = {}) => ({
  espaco_id: e.id, espaco_nome: e.nome, bloco, unidade: un, morador_nome: nome, data: diaBR(dia),
  horario_inicio: '12:00', horario_fim: '18:00', convidados_estimados: 15, status, ...extra,
});
falhar('reservas', (await admin.from('reservations').insert([
  reserva(salao, 'A', '101', 'Morador Proprietário', 5, 'PENDENTE'),
  reserva(salao, 'A', '102', 'Morador Inquilino', 9, 'APROVADA', { avaliado_por: 'Síndico Teste (SINDICO)', data_avaliacao: new Date().toISOString() }),
  reserva(churras, 'A', '102', 'Morador Inquilino', 7, 'APROVADA', { avaliado_por: 'Aprovação automática', data_avaliacao: new Date().toISOString() }),
  reserva(churras, 'A', '101', 'Morador Proprietário', 12, 'APROVADA', { avaliado_por: 'Aprovação automática', data_avaliacao: new Date().toISOString() }),
  reserva(salao, 'A', '101', 'Morador Proprietário', 14, 'RECUSADA', { motivo_recusa: 'Data reservada para a assembleia', avaliado_por: 'Síndico Teste (SINDICO)', data_avaliacao: new Date().toISOString() }),
])).error);
// Bloqueio simétrico Salão <-> Churrasqueira (0038). O par é guardado ORDENADO (espaco_a < espaco_b, comparação "C").
// Vem DEPOIS das reservas por costume: criar o bloqueio nunca mexe em reservas existentes, só barra novos pedidos.
{
  const [ea, eb] = salao.id < churras.id ? [salao.id, churras.id] : [churras.id, salao.id];
  falhar('bloqueio Salão e Churrasqueira', (await admin.from('space_blocks').insert({ espaco_a: ea, espaco_b: eb })).error);
}
falhar('aviso', (await admin.from('notices').insert({
  titulo: 'Bem-vindo ao ambiente de testes', conteudo: 'Esta base é de staging. Pode criar, editar e apagar à vontade.',
  categoria: 'COMUNICADO', autor: 'Síndico Teste', fixado: true,
})).error);

console.log(`Staging recriado: ${usuarios.length} usuários, ${units.length} unidades, 7 veículos, 4 espaços (Salão com faixa, Salão e Churrasqueira se bloqueiam), 5 reservas, 1 aviso.`);
console.log(`Contas (senha ${SENHA}):`);
for (const u of usuarios) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
console.log('  (convite pendente de cargo: Portaria Dois -> novo.porteiro@staging.test, link na fila de Usuários)');
