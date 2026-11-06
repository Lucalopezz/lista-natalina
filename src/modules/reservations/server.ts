import "server-only";
import { getDatabase, getMongoClient } from "../../lib/db/mongodb";
import { ensureGiftIndexes } from "../gifts/repository";
import { createMongoReservationRepository, ensureReservationIndexes } from "./repository";
import { createReservationService } from "./service";

let initialization: Promise<ReturnType<typeof createReservationService>> | undefined;
/** Só dependências/índices são reutilizados por instância; contexto, listas e
 * disponibilidade nunca entram em cache compartilhado entre pessoas. */
export function getReservationService() {
  initialization ??= (async () => {
    const [db, client] = await Promise.all([getDatabase(), getMongoClient()]);
    await Promise.all([ensureReservationIndexes(db), ensureGiftIndexes(db)]);
    return createReservationService(createMongoReservationRepository(db, client));
  })().catch(() => {
    initialization = undefined;
    throw new Error("Não foi possível carregar as listas e reservas agora.");
  });
  return initialization;
}
