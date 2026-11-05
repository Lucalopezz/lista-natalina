import "server-only";
import { getDatabase, getMongoClient } from "../../lib/db/mongodb";
import { readAuthEnv } from "./env";
import { createAuth, type Auth } from "./config";
import { ensureAuthIndexes } from "./indexes";

let initialization: Promise<Auth> | undefined;

/**
 * Configuração lazy mantém o build independente de credenciais/banco disponíveis.
 * A promessa compartilhada também espera os índices antes de aceitar qualquer escrita.
 * Se a conexão/configuração falhar, a próxima tentativa pode recuperar sem reiniciar.
 */
export function getAuth(): Promise<Auth> {
  initialization ??= (async () => {
    const env = readAuthEnv(process.env);
    const client = await getMongoClient();
    const db = await getDatabase();
    await ensureAuthIndexes(db);
    return createAuth(db, client, env);
  })().catch(() => {
    initialization = undefined;
    throw new Error("Não foi possível inicializar a autenticação.");
  });
  return initialization;
}
