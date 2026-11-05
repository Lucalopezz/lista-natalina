import { test as base, expect } from "@playwright/test";
import { MongoClient } from "mongodb";

export const test = base.extend<{ resetRateLimits: void }>({
  // O Playwright exige o padrão de desestruturação, mesmo sem dependências.
  resetRateLimits: [async ({}, use) => {
    const uri = process.env.E2E_DATABASE_URL ?? "";
    if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/lista_natalina_test\?directConnection=true$/.test(uri)) throw new Error("Use o runner E2E com banco descartável.");
    const client = new MongoClient(uri);
    try {
      await client.connect();
      // Casos independentes não podem consumir o limite de cadastro uns dos outros.
      // Não desabilitamos proteção na aplicação; só limpamos fixtures deste banco.
      await client.db().collection("rateLimit").deleteMany({});
    } finally { await client.close(); }
    await use();
  }, { auto: true }],
});
export { expect };
