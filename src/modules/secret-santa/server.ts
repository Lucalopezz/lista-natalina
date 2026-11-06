import "server-only";
import { getDatabase, getMongoClient } from "../../lib/db/mongodb";
import { createMongoDrawRepository, ensureDrawIndexes } from "./repository";
import { createSecretSantaService } from "./service";
let initialization: Promise<ReturnType<typeof createSecretSantaService>> | undefined;
export function getSecretSantaService() {
  initialization ??= (async () => {
    const [db, client] = await Promise.all([getDatabase(), getMongoClient()]);
    await ensureDrawIndexes(db);
    return createSecretSantaService(createMongoDrawRepository(db, client));
  })().catch(() => { initialization = undefined; throw new Error("Não foi possível carregar o amigo secreto agora."); });
  return initialization;
}
