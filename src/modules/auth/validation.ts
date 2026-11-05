import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
// Não aplicar trim na senha: espaços podem fazer parte da credencial escolhida.
const password = z.string().min(6, "Use pelo menos 6 caracteres.").max(128, "Use no máximo 128 caracteres.");
export const signInSchema = z.object({ email, password });
export const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(1, "Informe seu nome.").max(100, "Use no máximo 100 caracteres no nome."),
});
