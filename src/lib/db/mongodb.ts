import "server-only";
import { MongoClient } from "mongodb";
import { readServerEnv } from "../env/server";

declare global {
  var __listaNatalinaMongo: Promise<MongoClient> | undefined;
}

/** Uma promessa compartilhada evita criar pools em chamadas concorrentes e no hot reload. */
export function getMongoClient(): Promise<MongoClient> {
  if (!globalThis.__listaNatalinaMongo) {
    const env = readServerEnv(process.env);
    const client = new MongoClient(env.DATABASE_URL, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 5_000,
      waitQueueTimeoutMS: 5_000,
    });
    globalThis.__listaNatalinaMongo = client.connect().then(() => client).catch(async (error: unknown) => {
      globalThis.__listaNatalinaMongo = undefined;
      await client.close().catch(() => undefined);
      throw error;
    });
  }
  return globalThis.__listaNatalinaMongo;
}

export async function getDatabase() {
  const env = readServerEnv(process.env);
  const client = await getMongoClient();
  return client.db(env.DATABASE_NAME);
}
