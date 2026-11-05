import { giftIdSchema, giftInputSchema, giftQuerySchema } from "./validation";
import type { Gift, GiftRepository, GiftView } from "./types";

export class GiftError extends Error {
  constructor(public readonly code: "unauthorized" | "not_found" | "invalid", message: string) {
    super(message);
  }
}
function actorId(actor: string | null) {
  const parsed = giftIdSchema.safeParse(actor);
  if (!parsed.success) throw new GiftError("unauthorized", "Entre na sua conta para continuar.");
  return parsed.data;
}
function resourceId(id: unknown) {
  const parsed = giftIdSchema.safeParse(id);
  if (!parsed.success) throw new GiftError("not_found", "Presente não encontrado.");
  return parsed.data;
}
function validatedInput(input: unknown) {
  const parsed = giftInputSchema.safeParse(input);
  if (!parsed.success) throw new GiftError("invalid", "Confira os dados do presente.");
  return parsed.data;
}
function found<T>(value: T | null | false): T {
  if (!value) throw new GiftError("not_found", "Presente não encontrado.");
  return value;
}

/**
 * Projeção por lista permitida, sem espalhar documentos. Mesmo que uma persistência
 * futura incorpore metadados de reserva, o dono não recebe estado nem identidade.
 */
function view(gift: Gift): GiftView {
  return {
    id: gift.id, ownerId: gift.ownerId,
    name: gift.name, description: gift.description,
    productUrl: gift.productUrl, imageUrl: gift.imageUrl,
    createdAt: gift.createdAt.toISOString(), updatedAt: gift.updatedAt.toISOString(),
  };
}

/** Casos de uso da lista pessoal. O actor sempre vem da sessão na borda do servidor. */
export function createGiftService(repository: GiftRepository) {
  return {
    async create(actor: string | null, input: unknown) {
      const ownerId = actorId(actor);
      const data = validatedInput(input);
      const now = new Date();
      return view(await repository.insert({ ...data, ownerId, createdAt: now, updatedAt: now }));
    },
    async list(actor: string | null, query: unknown = {}) {
      const ownerId = actorId(actor);
      const parsed = giftQuerySchema.safeParse(query);
      if (!parsed.success) throw new GiftError("invalid", "Página de presentes inválida.");
      // Não existe parâmetro de outro proprietário: grupos terão autorização
      // contextual própria na Fase 5, sem relaxar esta consulta da lista pessoal.
      const result = await repository.listOwned(ownerId, parsed.data.cursor);
      return { gifts: result.gifts.map(view), nextCursor: result.nextCursor };
    },
    async get(actor: string | null, id: unknown) {
      const ownerId = actorId(actor);
      return view(found(await repository.findOwned(ownerId, resourceId(id))));
    },
    async update(actor: string | null, id: unknown, input: unknown) {
      const ownerId = actorId(actor);
      const targetId = resourceId(id);
      const data = validatedInput(input);
      // A autorização faz parte do filtro de escrita, não de um find anterior
      // que poderia ser esquecido ou ficar desatualizado antes do update.
      return view(found(await repository.updateOwned(ownerId, targetId, { ...data, updatedAt: new Date() })));
    },
    async remove(actor: string | null, id: unknown) {
      const ownerId = actorId(actor);
      found(await repository.deleteOwned(ownerId, resourceId(id)));
    },
  };
}
