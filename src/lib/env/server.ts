import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().regex(/^mongodb(?:\+srv)?:\/\/[^/\s?#]+(?:[/?][^\s#]*)?$/),
  DATABASE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).optional(),
});

/** Validação lazy: importar um módulo não exige banco disponível durante o build. */
export function readServerEnv(source: Record<string, string | undefined>) {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Não incluir o erro original: ele pode conter credenciais da URI.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Configuração do servidor inválida: ${fields.join(", ")}`);
  }
  return result.data;
}
