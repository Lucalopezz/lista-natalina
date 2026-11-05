import "server-only";
import { betterAuth } from "better-auth/minimal";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import type { Db, MongoClient } from "mongodb";
import type { readAuthEnv } from "./env";

/**
 * A biblioteca é responsável pelo hash scrypt, cookies assinados e sessões persistidas.
 * A fábrica recebe o banco para os testes usarem a mesma configuração contra MongoDB
 * descartável, sem acessar a conexão real do usuário ou duplicar regras em mocks.
 */
export function createAuth(db: Db, client: MongoClient, env: ReturnType<typeof readAuthEnv>) {
  return betterAuth({
    appName: "Lista Natalina",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: mongodbAdapter(db, { client }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      // Sem cache em cookie: logout/revogação no banco precisam valer na próxima leitura.
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 10 },
      },
    },
    advanced: {
      useSecureCookies: env.BETTER_AUTH_URL.startsWith("https:"),
      ipAddress: {
        // Na Vercel só confiamos no header substituído pelo proxy da plataforma.
        // Fora dela, um contador compartilhado é preferível a confiar em IP forjado.
        ipAddressHeaders: process.env.VERCEL === "1" ? ["x-vercel-forwarded-for"] : [],
      },
    },
    // Falhas de infraestrutura serão traduzidas na borda HTTP. O erro bruto do driver
    // não pode ir para logs porque pode conter a URI e outros detalhes privados.
    logger: { disabled: true },
  });
}
export type Auth = ReturnType<typeof createAuth>;
