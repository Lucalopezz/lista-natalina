#!/usr/bin/env bash
set -euo pipefail
# Usa exclusivamente um MongoDB novo em tmpfs. Nunca carrega .env nem usa DATABASE_URL.
mode="${1:-integration}"
container="lista-natalina-tests-$$"
server_pid=""
server_log="$(mktemp)"
cleanup() {
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; fi
  docker stop "$container" >/dev/null 2>&1 || true
  rm -- "$server_log"
}
trap cleanup EXIT INT TERM
# Desativa a reserva mínima de espaço de índices somente neste banco em memória.
docker run --rm -d --name "$container" --tmpfs /data/db:rw,size=512m \
  -p 127.0.0.1::27017 mongo:8.0 --replSet rs0 --bind_ip_all \
  --setParameter indexBuildMinAvailableDiskSpaceMB=0 >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})' >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" mongosh --quiet --eval 'if(!db.hello().isWritablePrimary) quit(1)' >/dev/null 2>&1; then break; fi
  sleep 1
done
mongo_port="$(docker port "$container" 27017 | cut -d: -f2)"
test_uri="mongodb://127.0.0.1:${mongo_port}/lista_natalina_test?directConnection=true"
if [ "$mode" = integration ]; then
  INTEGRATION_DATABASE_URL="$test_uri" pnpm exec vitest run src/modules/auth/auth.integration.test.ts
elif [ "$mode" = e2e ]; then
  app_port="$(node --input-type=module -e 'import net from "node:net"; const s=net.createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
  test_origin="http://localhost:${app_port}"
  # Estas variáveis sobrepõem .env no processo Next, inclusive se ele aponta a produção.
  DATABASE_URL="$test_uri" DATABASE_NAME=lista_natalina_test \
    BETTER_AUTH_URL="$test_origin" BETTER_AUTH_SECRET=isolated-browser-tests-only-not-a-real-production-secret \
    node node_modules/next/dist/bin/next start --port "$app_port" >"$server_log" 2>&1 &
  server_pid=$!
  for attempt in $(seq 1 30); do
    if TEST_ORIGIN="$test_origin" node --input-type=module -e 'await fetch(process.env.TEST_ORIGIN)' >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if command -v chromium >/dev/null; then export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(command -v chromium)"; fi
  E2E_BASE_URL="$test_origin" pnpm exec playwright test
else
  echo "Modo de teste desconhecido." >&2
  exit 1
fi
