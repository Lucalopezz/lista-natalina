import "server-only";
import type { Db } from "mongodb";

/**
 * A consulta de email feita pela biblioteca não impede dois cadastros simultâneos.
 * O índice único é a garantia final; transações impedem credenciais/sessões órfãs.
 * Inicialização idempotente: executar uma vez ao preparar a instância de auth,
 * nunca em cada consulta de sessão. Duplicatas preexistentes devem falhar fechadas.
 */
export async function ensureAuthIndexes(db: Db) {
  await Promise.all([
    db.collection("user").createIndex({ email: 1 }, { unique: true }),
    db.collection("session").createIndex({ token: 1 }, { unique: true }),
    db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("session").createIndex({ userId: 1 }),
    db.collection("account").createIndex({ providerId: 1, accountId: 1 }, { unique: true }),
    db.collection("account").createIndex({ userId: 1 }),
    db.collection("rateLimit").createIndex({ key: 1 }, { unique: true }),
  ]);
}
