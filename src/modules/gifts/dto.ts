import type { Gift, GiftView } from "./types";

/**
 * Lista permitida de campos do presente, compartilhada pela lista pessoal e por
 * leituras autorizadas de grupos. Nunca espalhar documentos: mesmo que o banco
 * acrescente versões ou metadados de reserva, o dono não recebe esses campos.
 */
export function toGiftView(gift: Gift): GiftView {
  return {
    id: gift.id, ownerId: gift.ownerId,
    name: gift.name, description: gift.description,
    productUrl: gift.productUrl, imageUrl: gift.imageUrl,
    createdAt: gift.createdAt.toISOString(), updatedAt: gift.updatedAt.toISOString(),
  };
}
