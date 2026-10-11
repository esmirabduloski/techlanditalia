#!/usr/bin/env bash
# Test automatici dei permessi (RLS) sul database.
#
# Avvia un Postgres usa-e-getta con l'immagine ufficiale di Supabase, riapplica
# da zero tutte le migrazioni (supabase/migrations, poi drizzle/migrations
# nell'ordine del journal), crea utenti e dati finti e verifica che:
#   - un alunno non veda i dati di un altro alunno;
#   - un genitore veda solo i dati dei propri figli;
#   - un insegnante veda solo i propri gruppi e i loro alunni.
#
# Uso:  npm run test:rls        (serve Docker avviato)
#       KEEP_DB=1 npm run test:rls   lascia il container acceso per ispezionarlo
set -euo pipefail

cd "$(dirname "$0")/.."
IMAGE="${RLS_TEST_IMAGE:-supabase/postgres:15.8.1.085}"
NAME="techland-rls-test-$$"

cleanup() {
  if [ -z "${KEEP_DB:-}" ]; then
    docker rm -f "$NAME" >/dev/null 2>&1 || true
  else
    echo "Container lasciato acceso: docker exec -it $NAME psql -U postgres -h localhost"
  fi
}
trap cleanup EXIT

echo "▶ Avvio Postgres ($IMAGE)"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -v "$PWD":/repo:ro "$IMAGE" >/dev/null
for _ in $(seq 1 90); do
  if docker exec "$NAME" psql -U postgres -h localhost -Atc "select 1" >/dev/null 2>&1; then break; fi
  sleep 2
done
# L'immagine esegue i suoi script di init e poi riavvia il server: aspetta che sia stabile.
sleep 3
for _ in $(seq 1 30); do
  if docker exec "$NAME" psql -U postgres -h localhost -Atc "select 1" >/dev/null 2>&1; then break; fi
  sleep 2
done

run_sql() { # $1 = utente, $2 = file dentro /repo
  docker exec ${PGOPTS:+-e PGOPTIONS="$PGOPTS"} "$NAME" psql -U "$1" -h localhost -d postgres -q -X \
    -v ON_ERROR_STOP=1 --single-transaction -f "/repo/$2"
}

run_sql supabase_admin supabase/tests/rls/00_bootstrap.sql

echo "▶ Applico le migrazioni"
# Alcune migrazioni inseriscono dati legati a utenti reali di produzione:
# replica sospende FK e trigger durante la riapplicazione.
PGOPTS="-c session_replication_role=replica"
count=0
for f in $(ls supabase/migrations/*.sql | sort); do
  if ! out=$(run_sql postgres "$f" 2>&1); then
    echo "✗ Migrazione fallita: $f"; echo "$out"; exit 1
  fi
  count=$((count + 1))
done
run_sql postgres supabase/tests/rls/00_drift.sql
for tag in $(node -e 'for (const e of require("./drizzle/migrations/meta/_journal.json").entries) console.log(e.tag)'); do
  f="drizzle/migrations/$tag.sql"
  if ! out=$(run_sql postgres "$f" 2>&1); then
    echo "✗ Migrazione fallita: $f"; echo "$out"; exit 1
  fi
  count=$((count + 1))
done
echo "  $count migrazioni applicate"
PGOPTS=""

echo "▶ Dati di prova"
run_sql supabase_admin supabase/tests/rls/01_seed.sql

echo "▶ Verifica dei permessi"
if ! out=$(run_sql postgres supabase/tests/rls/02_checks.sql 2>&1); then
  echo "$out" | sed -nE 's/.*(NOTICE|ERROR): *//p'
  echo "✗ Test dei permessi FALLITI"
  exit 1
fi
echo "$out" | sed -n 's/.*NOTICE: *//p'
echo "✓ Test dei permessi superati"
