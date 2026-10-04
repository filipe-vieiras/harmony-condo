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
  'notices', 'notifications', 'audit_logs', 'pending_invites', 'units',
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

// ── 3) Usuários (um por perfil) ──
const usuarios = [
  { email: 'sindico@staging.test', name: 'Síndico Teste', role: 'SINDICO' },
  { email: 'subsindico@staging.test', name: 'Subsíndico Teste', role: 'SUBSINDICO' },
  { email: 'adm@staging.test', name: 'Administradora Teste', role: 'ADM' },
  { email: 'portaria@staging.test', name: 'Portaria Teste', role: 'PORTARIA' },
  { email: 'conselho@staging.test', name: 'Conselho Teste', role: 'CONSELHO' },
  { email: 'morador@staging.test', name: 'Morador Proprietário', role: 'MORADOR', bloco: 'A', unidade: '101', telefone: '(11) 91111-1111' },
  { email: 'inquilino@staging.test', name: 'Morador Inquilino', role: 'MORADOR', bloco: 'A', unidade: '102', telefone: '(11) 92222-2222' },
];
for (const u of usuarios) {
  const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: SENHA, email_confirm: true });
  falhar(`criar ${u.email}`, error);
  const { error: pErr } = await admin.from('profiles').insert({
    id: data.user.id, email: u.email, name: u.name, role: u.role,
    bloco: u.bloco ?? null, unidade: u.unidade ?? null, telefone: u.telefone ?? null,
  });
  falhar(`perfil ${u.email}`, pErr);
  if (u.bloco) {
    const { error: lErr } = await admin.from('units')
      .update({ usuario_id: data.user.id, status_convite: 'ATIVO' })
      .eq('id', unitDe(u.bloco, u.unidade).id);
    falhar(`vincular ${u.email}`, lErr);
  }
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
// Espaços: o Salão exige aprovação da equipe (padrão); a Churrasqueira confirma na hora; a Quadra está em manutenção.
const { data: espacos, error: espErr } = await admin.from('spaces').insert([
  { nome: 'Salão de Festas', descricao: 'Salão para até 50 pessoas', capacidade_max: 50, horario_funcionamento: '10h às 22h', taxa_limpeza: 150, regras: ['Silêncio após as 22h'], ativo: true, exige_aprovacao: true },
  { nome: 'Churrasqueira', descricao: 'Churrasqueira coberta para até 20 pessoas', capacidade_max: 20, horario_funcionamento: '10h às 22h', taxa_limpeza: 0, regras: ['Limpar após o uso'], ativo: true, exige_aprovacao: false },
  { nome: 'Quadra Poliesportiva', descricao: 'Quadra em manutenção para teste do aviso', capacidade_max: 30, horario_funcionamento: '08h às 20h', taxa_limpeza: 0, regras: [], ativo: false, exige_aprovacao: true },
]).select();
falhar('espaços', espErr);
const salao = espacos.find((e) => e.nome === 'Salão de Festas');
const churras = espacos.find((e) => e.nome === 'Churrasqueira');

// Reservas em dias diferentes (data de Brasília; a seed roda sem usuário, então o banco não mexe no status).
// Salão: um pedido aguardando (A-101) e uma aprovada (A-102). Churrasqueira: confirmada automaticamente (A-102)
// no mesmo dia do pedido do Salão, para o teste de "espaços diferentes no mesmo dia".
const hojeBR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const diaBR = (n) => new Date(Date.parse(hojeBR + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const reserva = (e, bloco, un, nome, dia, status, extra = {}) => ({
  espaco_id: e.id, espaco_nome: e.nome, bloco, unidade: un, morador_nome: nome, data: diaBR(dia),
  horario_inicio: '12:00', horario_fim: '18:00', convidados_estimados: 15, status, ...extra,
});
falhar('reservas', (await admin.from('reservations').insert([
  reserva(salao, 'A', '101', 'Morador Proprietário', 5, 'PENDENTE'),
  reserva(salao, 'A', '102', 'Morador Inquilino', 9, 'APROVADA', { avaliado_por: 'Síndico Teste (SINDICO)', data_avaliacao: new Date().toISOString() }),
  reserva(churras, 'A', '102', 'Morador Inquilino', 5, 'APROVADA', { avaliado_por: 'Aprovação automática', data_avaliacao: new Date().toISOString() }),
  reserva(churras, 'A', '101', 'Morador Proprietário', 12, 'APROVADA', { avaliado_por: 'Aprovação automática', data_avaliacao: new Date().toISOString() }),
  reserva(salao, 'A', '101', 'Morador Proprietário', 14, 'RECUSADA', { motivo_recusa: 'Data reservada para a assembleia', avaliado_por: 'Síndico Teste (SINDICO)', data_avaliacao: new Date().toISOString() }),
])).error);
falhar('aviso', (await admin.from('notices').insert({
  titulo: 'Bem-vindo ao ambiente de testes', conteudo: 'Esta base é de staging. Pode criar, editar e apagar à vontade.',
  categoria: 'COMUNICADO', autor: 'Síndico Teste', fixado: true,
})).error);

console.log(`Staging recriado: ${usuarios.length} usuários, ${units.length} unidades, 7 veículos, 3 espaços, 5 reservas, 1 aviso.`);
console.log(`Contas (senha ${SENHA}):`);
for (const u of usuarios) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
