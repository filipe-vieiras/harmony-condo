#!/usr/bin/env bash
# Operações em PRODUÇÃO (znajvgkfhucidxtsfdip), sempre rodadas pelo dono no próprio terminal.
#
# Uso:
#   ./scripts/producao.sh checar                          só leitura: o que já está aplicado + dados que as migrações validam
#   ./scripts/producao.sh backup                          pg_dump completo em backups/ (ignorado pelo git)
#   ./scripts/producao.sh aplicar supabase/migrations/NNNN_nome.sql
#
# Travas:
#  - só usa PROD_DB_* de .env.staging.local e recusa se o usuário não for o do projeto de produção;
#  - "aplicar" exige backup feito nos últimos 60 minutos e que você digite o nome do arquivo para confirmar;
#  - roda a migração em uma transação única, parando no primeiro erro; nunca roda duas vezes;
#  - nunca imprime a senha.
set -euo pipefail

PROD_REF="znajvgkfhucidxtsfdip"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

pega() { grep -E "^$1=" .env.staging.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"; }
HOST="$(pega PROD_DB_HOST)"; USER_DB="$(pega PROD_DB_USER)"; export PGPASSWORD="$(pega PROD_DB_PASSWORD)" PGSSLMODE=require
[ -n "$HOST" ] && [ -n "$USER_DB" ] && [ -n "$PGPASSWORD" ] || { echo "Faltam PROD_DB_* em .env.staging.local" >&2; exit 2; }
[ "$USER_DB" = "postgres.$PROD_REF" ] || { echo "Recusado: o usuário do banco não é o de produção ($PROD_REF)." >&2; exit 3; }

BIN=/opt/homebrew/opt/libpq/bin
psqlp() { "$BIN/psql" -h "$HOST" -p 5432 -U "$USER_DB" -d postgres -X -v ON_ERROR_STOP=1 "$@"; }

case "${1:-}" in
  checar)
    echo "== PRODUÇÃO ($PROD_REF) — somente leitura"
    psqlp -A -F ' | ' -c "set default_transaction_read_only = on;" -c "
select 'livro_config existe (0043)' as item, (select count(*) from information_schema.tables where table_name='livro_config')::text as valor
union all select 'livro_definir_modo ainda checa a trava (0044 NÃO aplicada se true)', coalesce((select (position('liberado_para_abrir' in pg_get_functiondef(p.oid))>0)::text from pg_proc p where proname='livro_definir_modo' limit 1),'sem função')
union all select 'livro_definir_modo é a versão da 0046 (trava for update; deve ser true)', coalesce((select (position('for update' in lower(pg_get_functiondef(p.oid)))>0)::text from pg_proc p where proname='livro_definir_modo' limit 1),'sem função')
union all select 'diretorio_unidades usa is_admin (0045 aplicada se true)', coalesce((select (position('is_admin' in pg_get_functiondef(p.oid))>0)::text from pg_proc p where proname='diretorio_unidades' limit 1),'sem função')
union all select 'limite_respostas_autor no livro (0046 aplicada se true)', coalesce((select (position('limite_respostas_autor' in pg_get_functiondef(p.oid))>0)::text from pg_proc p where proname='livro_msg_antes' limit 1),'sem função')
union all select 'url_http_valida (0047 aplicada se 1)', (select count(*) from pg_proc where proname='url_http_valida')::text
union all select 'unit_documentos (0040)', (select count(*) from information_schema.tables where table_name='unit_documentos')::text
union all select 'convite_links (0042)', (select count(*) from information_schema.tables where table_name='convite_links')::text;" \
      -c "select 'links fora de http(s) (deve ser 0)' as dado, count(*)::text as valor from documents where link_externo !~* '^https?://\S+\$' and link_externo <> '#'
union all select 'reservas com fim <= início (deve ser 0)', count(*)::text from reservations where horario_fim <= horario_inicio
union all select 'perfis', count(*)::text from profiles
union all select 'unidades', count(*)::text from units;"
    ;;
  backup)
    mkdir -p backups
    ARQ="backups/producao-$(date +%Y%m%d-%H%M%S).dump"
    echo "== Backup de produção em $ARQ"
    "$BIN/pg_dump" -h "$HOST" -p 5432 -U "$USER_DB" -d postgres -Fc --no-owner -f "$ARQ"
    ls -lh "$ARQ"
    ;;
  aplicar)
    ARQUIVO="${2:-}"
    case "$ARQUIVO" in supabase/migrations/*.sql) ;; *) echo "Recusado: só supabase/migrations/*.sql" >&2; exit 2 ;; esac
    case "$ARQUIVO" in *..*) echo "Recusado: caminho inválido." >&2; exit 2 ;; esac
    [ -f "$ARQUIVO" ] || { echo "Arquivo não encontrado: $ARQUIVO" >&2; exit 2; }
    RECENTE="$(find backups -name 'producao-*.dump' -mmin -60 2>/dev/null | head -1 || true)"
    [ -n "$RECENTE" ] || { echo "Recusado: faça ./scripts/producao.sh backup (nos últimos 60 min) antes." >&2; exit 4; }
    echo "Backup recente: $RECENTE"
    echo "Vai aplicar em PRODUÇÃO: $ARQUIVO"
    read -r -p "Digite o nome do arquivo para confirmar: " RESP
    [ "$RESP" = "$(basename "$ARQUIVO")" ] || { echo "Confirmação não confere. Nada foi feito." >&2; exit 5; }
    psqlp --single-transaction -f "$ARQUIVO" 2>&1 | tail -8
    echo "== Migração aplicada em PRODUÇÃO: $ARQUIVO"
    ;;
  *)
    echo "Uso: $0 {checar|backup|aplicar <migração.sql>}" >&2; exit 2 ;;
esac
