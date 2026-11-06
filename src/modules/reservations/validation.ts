import { z } from "zod";
import { giftIdSchema } from "../gifts/validation";

// A URL contém o contexto e o dono da lista; ambos são validados novamente na
// action e no serviço. O ID do presente nunca substitui esses relacionamentos.
export const wishlistPathSchema = z.object({ groupId: giftIdSchema, ownerId: giftIdSchema });
export const reservationPathSchema = wishlistPathSchema.extend({ giftId: giftIdSchema });
export const wishlistQuerySchema = z.object({ cursor: giftIdSchema.optional() });
