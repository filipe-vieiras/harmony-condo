#!/usr/bin/env bash
# Aplica uma migração SQL SOMENTE no banco de STAGING (yusmuzifhhlowuqtcnid).
#
# Uso: ./scripts/aplicar-staging.sh supabase/migrations/NNNN_nome.sql [--duas-vezes]
#
# Por segurança este script:
#  - lê só as variáveis STAGING_DB_* de .env.staging.local (as PROD_DB_* nem são carregadas);
#  - recusa rodar se o usuário do banco não for o do projeto de staging;
#  - só aceita arquivos .sql dentro de supabase/migrations/;
#  - roda cada migração em uma transação única, parando no primeiro erro;
#  - nunca imprime a senha.
# Migração em PRODUÇÃO não passa por aqui: só com autorização escrita do dono, na sessão principal.
set -euo pipefail

STAGING_REF="yusmuzifhhlowuqtcnid"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

ARQUIVO="${1:-}"
DUAS_VEZES="${2:-}"
[ -n "$ARQUIVO" ] || { echo "Uso: $0 supabase/migrations/NNNN_nome.sql [--duas-vezes]" >&2; exit 2; }

# Só migrações do projeto (sem ../ e sem caminhos absolutos).
case "$ARQUIVO" in
  supabase/migrations/*.sql) ;;
  *) echo "Recusado: só aceito arquivos em supabase/migrations/*.sql" >&2; exit 2 ;;
esac
case "$ARQUIVO" in *..*) echo "Recusado: caminho inválido." >&2; exit 2 ;; esac
[ -f "$ARQUIVO" ] || { echo "Arquivo não encontrado: $ARQUIVO" >&2; exit 2; }

# Carrega apenas STAGING_DB_* (nunca PROD_DB_*).
pega() { grep -E "^$1=" .env.staging.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"; }
STAGING_DB_HOST="$(pega STAGING_DB_HOST)"
STAGING_DB_USER="$(pega STAGING_DB_USER)"
STAGING_DB_PASSWORD="$(pega STAGING_DB_PASSWORD)"
[ -n "$STAGING_DB_HOST" ] && [ -n "$STAGING_DB_USER" ] && [ -n "$STAGING_DB_PASSWORD" ] \
  || { echo "Faltam STAGING_DB_HOST/USER/PASSWORD em .env.staging.local" >&2; exit 2; }

# Trava de segurança: o usuário do pooler tem o formato postgres.<ref do projeto>.
if [ "$STAGING_DB_USER" != "postgres.$STAGING_REF" ]; then
  echo "Recusado: o usuário do banco não é o do staging ($STAGING_REF)." >&2
  exit 3
fi

export PGPASSWORD="$STAGING_DB_PASSWORD" PGSSLMODE=require
PSQL=/opt/homebrew/opt/libpq/bin/psql

rodadas=1
[ "$DUAS_VEZES" = "--duas-vezes" ] && rodadas=2

for i in $(seq 1 "$rodadas"); do
  echo "== Rodada $i de $rodadas: $ARQUIVO (staging $STAGING_REF)"
  "$PSQL" -h "$STAGING_DB_HOST" -p 5432 -U "$STAGING_DB_USER" -d postgres \
    -v ON_ERROR_STOP=1 --single-transaction -f "$ARQUIVO" 2>&1 | tail -3
done
echo "== Migração aplicada no staging."
