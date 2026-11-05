import "server-only";
import { z } from "zod";

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
