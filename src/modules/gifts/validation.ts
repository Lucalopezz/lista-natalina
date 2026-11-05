import { z } from "zod";

/** Links são abertos pelo navegador; o servidor não baixa produto nem imagem. */
const webUrl = z.string().trim().max(2048, "Use uma URL com até 2048 caracteres.").refine((value) => {
  if (/[\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}, "Informe uma URL HTTP ou HTTPS válida, sem credenciais.");

export const giftInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do presente.").max(120, "Use até 120 caracteres."),
  description: z.string().trim().min(1, "Descreva o presente.").max(2000, "Use até 2000 caracteres."),
  productUrl: webUrl,
  imageUrl: webUrl,
});
export const giftIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Presente inválido.").transform((id) => id.toLowerCase());
export const giftQuerySchema = z.object({ cursor: giftIdSchema.optional() });
export type GiftInput = z.infer<typeof giftInputSchema>;
export type GiftField = keyof GiftInput;
