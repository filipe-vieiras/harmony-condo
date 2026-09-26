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
  { placa: 'STG1A01', marca: 'Volkswagen', modelo: 'Gol', cor: 'Prata', bloco: 'A', unidade: '101', vaga: 'A101', proprietario_nome: 'Morador Proprietário', telefone_contato: '(11) 91111-1111', unit_id: a101.id },
  { placa: 'STG2B02', marca: 'Honda', modelo: 'Civic', cor: 'Preto', bloco: 'A', unidade: '102', vaga: 'A102', proprietario_nome: 'Morador Inquilino', telefone_contato: '(11) 92222-2222', unit_id: a102.id },
])).error);
falhar('espaço', (await admin.from('spaces').insert({
  nome: 'Salão de Festas', descricao: 'Salão para até 50 pessoas', capacidade_max: 50,
  horario_funcionamento: '10h às 22h', taxa_limpeza: 150, regras: ['Silêncio após as 22h'], ativo: true,
})).error);
falhar('aviso', (await admin.from('notices').insert({
  titulo: 'Bem-vindo ao ambiente de testes', conteudo: 'Esta base é de staging. Pode criar, editar e apagar à vontade.',
  categoria: 'COMUNICADO', autor: 'Síndico Teste', fixado: true,
})).error);

console.log(`Staging recriado: ${usuarios.length} usuários, ${units.length} unidades, 2 veículos, 1 espaço, 1 aviso.`);
console.log(`Contas (senha ${SENHA}):`);
for (const u of usuarios) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
