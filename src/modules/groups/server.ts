import "server-only";
import { getDatabase, getMongoClient } from "../../lib/db/mongodb";
import { createMongoGroupRepository, ensureGroupIndexes } from "./repository";
import { createGroupService } from "./service";

let initialization: Promise<ReturnType<typeof createGroupService>> | undefined;
export function getGroupService() {
  initialization ??= (async () => {
    const [db, client] = await Promise.all([getDatabase(), getMongoClient()]);
    await ensureGroupIndexes(db);
    return createGroupService(createMongoGroupRepository(db, client));
  })().catch(() => {
    initialization = undefined;
    throw new Error("Não foi possível carregar os grupos agora.");
  });
  return initialization;
}
