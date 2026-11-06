#!/usr/bin/env bash
set -euo pipefail
# Usa exclusivamente um MongoDB novo em tmpfs. Nunca carrega .env nem usa DATABASE_URL.
mode="${1:-integration}"
container="lista-natalina-tests-$$"
container_id=""
server_pid=""
server_log="$(mktemp)"
cleanup() {
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; fi
  # Só limpamos o ID devolvido pela criação bem-sucedida desta execução. Se o
  # nome colidir e docker run falhar, não podemos remover o container existente.
  if [ -n "$container_id" ]; then
    docker stop "$container_id" >/dev/null 2>&1 || true
    docker rm "$container_id" >/dev/null 2>&1 || true
  fi
  rm -- "$server_log"
}
trap cleanup EXIT INT TERM
# tmpfs reserva capacidade em memória, sem ocupar HD. 1 GiB também comporta
# a margem de espaço para índices de versões MongoDB que exigem 500 MiB livres.
container_id="$(docker run -d --name "$container" --tmpfs /data/db:rw,size=1g \
  -p 127.0.0.1::27017 mongo:7.0.45 --replSet rs0 --bind_ip_all)"
wait_for_mongo() {
  for attempt in $(seq 1 30); do
    if docker exec "$container" mongosh --quiet --eval "$1" >/dev/null 2>&1; then return 0; fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]; then break; fi
    sleep 1
  done
  echo "O MongoDB descartável não ficou pronto para os testes." >&2
  # Somente este container de fixtures: nenhum dado ou configuração de produção.
  docker logs --tail 30 "$container" >&2
  return 1
}
wait_for_mongo 'db.adminCommand({ping:1})'
docker exec "$container" mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})' >/dev/null
wait_for_mongo 'if(!db.hello().isWritablePrimary) quit(1)'
mongo_port="$(docker port "$container" 27017 | cut -d: -f2)"
test_uri="mongodb://127.0.0.1:${mongo_port}/lista_natalina_test?directConnection=true"
if [ "$mode" = integration ]; then
  INTEGRATION_DATABASE_URL="$test_uri" pnpm exec vitest run .integration.test.ts
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
  E2E_BASE_URL="$test_origin" E2E_DATABASE_URL="$test_uri" pnpm exec playwright test "${@:2}"
else
  echo "Modo de teste desconhecido." >&2
  exit 1
fi
