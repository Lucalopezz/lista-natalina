import "server-only";
import { z } from "zod";
import { readServerEnv } from "../../lib/env/server";

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().refine((value) => {
    try {
      const url = new URL(value);
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      return (url.protocol === "https:" || (local && url.protocol === "http:"))
        && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
    } catch { return false; }
  }).transform((value) => new URL(value).origin),
});

/** Exige origem explícita para que hosts e redirects do cliente não definam a confiança. */
export function readAuthEnv(source: Record<string, string | undefined>) {
  const parsed = authEnvSchema.safeParse(source);
  if (!parsed.success) {
    // A mensagem contém só os nomes dos campos; o erro Zod original pode incluir segredos.
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Configuração da autenticação inválida: ${fields.join(", ")}`);
  }
  return parsed.data;
}

/** Não aceitar silenciosamente o banco padrão `test` ao habilitar contas reais. */
export function readAuthDatabaseName(source: Record<string, string | undefined>) {
  const env = readServerEnv(source);
  if (env.DATABASE_NAME) return env.DATABASE_NAME;
  const explicitName = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(env.DATABASE_URL)?.[1];
  if (!explicitName) throw new Error("Configure DATABASE_NAME ou informe o banco explicitamente em DATABASE_URL.");
  return decodeURIComponent(explicitName);
}
