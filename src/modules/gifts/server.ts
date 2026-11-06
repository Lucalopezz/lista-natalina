import "server-only";
import { getDatabase, getMongoClient } from "../../lib/db/mongodb";
import { createMongoGiftRepository, ensureGiftIndexes } from "./repository";
import { createGiftService } from "./service";

let initialization: Promise<ReturnType<typeof createGiftService>> | undefined;

/** Inicializa índice uma vez por instância, somente após a autenticação na borda. */
export function getGiftService() {
  initialization ??= (async () => {
    const [db, client] = await Promise.all([getDatabase(), getMongoClient()]);
    await ensureGiftIndexes(db);
    return createGiftService(createMongoGiftRepository(db, client));
  })().catch(() => {
    initialization = undefined;
    throw new Error("Não foi possível carregar a lista de presentes agora.");
  });
  return initialization;
}
