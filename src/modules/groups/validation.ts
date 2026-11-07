import { z } from "zod";

export const groupIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Identificador inválido.").transform((value) => value.toLowerCase());
export const groupInfoSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do grupo.").max(120, "Use até 120 caracteres."),
  description: z.preprocess((value) => value == null ? "" : value, z.string().trim().max(2000, "Use até 2000 caracteres.")),
});
export const groupCreateSchema = groupInfoSchema.extend({ type: z.enum(["conventional", "secret_santa"]) });
export const groupPageSchema = z.object({ cursor: groupIdSchema.optional() });
// A paginação da busca segue relevância + ID. Não reutiliza o cursor simples
// dos membros, pois isso perderia aproximações com ID anterior aos nomes literais.
export const candidateQuerySchema = z.object({ q: z.string().trim().max(100).default(""), cursor: z.string().regex(/^[01]:[a-f\d]{24}$/i).optional() });
export type GroupInfo = z.infer<typeof groupInfoSchema>;
export type GroupType = z.infer<typeof groupCreateSchema>["type"];
