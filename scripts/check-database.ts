import { getDatabase, getMongoClient } from "../src/lib/db/mongodb";

try {
  const db = await getDatabase();
  await db.command({ ping: 1 });
  const topology = await db.admin().command({ hello: 1 });
  const transactionsSupported = Boolean(topology.setName || topology.msg === "isdbgrid");
  console.info("MongoDB: conexão e ping OK. Nenhum documento alterado.");
  console.info(`Topologia compatível com transações: ${transactionsSupported ? "sim" : "não"}.`);
  if (!transactionsSupported) process.exitCode = 1;
} catch {
  // O driver pode incluir hosts ou credenciais no erro; não registrar o objeto original.
  console.error("Não foi possível verificar o MongoDB. Confira DATABASE_URL, rede/TLS e permissões.");
  process.exitCode = 1;
} finally {
  if (globalThis.__listaNatalinaMongo) {
    await (await getMongoClient()).close();
    globalThis.__listaNatalinaMongo = undefined;
  }
}
