-- Harmony Residence — corrige audit_logs.id sem valor default
-- Achado ao testar o convite: toda gravação em audit_logs vinha falhando
-- silenciosamente (a trilha de auditoria estava sempre vazia) porque a
-- coluna id é uuid mas não tinha default, e o app nunca envia um id manual.

alter table public.audit_logs
  alter column id set default gen_random_uuid();
