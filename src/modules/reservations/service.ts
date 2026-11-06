import { giftIdSchema } from "../gifts/validation";
import { toGiftView } from "../gifts/dto";
import { reservationPathSchema, wishlistPathSchema, wishlistQuerySchema } from "./validation";
import type { AccessGroup, ReservationRepository, ReservationUnit, SecretSantaView, WishlistView } from "./types";

export class ReservationError extends Error {
  constructor(public readonly code: "unauthorized" | "not_found" | "invalid" | "forbidden" | "unavailable", message: string) { super(message); }
}
function notFound(): never { throw new ReservationError("not_found", "Não foi possível acessar esta lista ou este presente no grupo."); }
function identity(actor: string | null) {
  const result = giftIdSchema.safeParse(actor);
  if (!result.success) throw new ReservationError("unauthorized", "Entre na sua conta para continuar.");
  return result.data;
}

/** Regras de compartilhamento e disponibilidade, sem aceitar identidade ou
 * edição do cliente. A mesma política é reaplicada ao consultar, reservar e cancelar. */
export function createReservationService(repository: ReservationRepository) {
  async function groupFor(unit: ReservationUnit, actor: string, groupId: string, write = false) {
    const group = await (write ? unit.lockGroup(groupId) : unit.getGroup(groupId));
    if (!group || !await unit.isMember(groupId, actor)) notFound();
    return group;
  }
  async function authorize(unit: ReservationUnit, group: AccessGroup, actor: string, owner: string) {
    if (!await unit.isMember(group.id, owner)) notFound();
    if (actor === owner || group.type === "conventional") return;
    // Outro grupo convencional em comum não concede acesso neste contexto.
    // O repositório só lê a atribuição da sessão e exige edição válida/atual.
    if (!group.activeDrawId || await unit.recipient(group, actor) !== owner) notFound();
  }
  /** Chamadores já autorizaram o dono no mesmo snapshot. Centralizar aqui evita
   * consultar resultado em uma transação e disponibilidade em outra edição. */
  async function readWishlist(unit: ReservationUnit, group: AccessGroup, user: string, ownerId: string, cursor?: string): Promise<WishlistView> {
    const owner = await unit.profile(ownerId);
    if (!owner) notFound();
    const result = await unit.listGifts(owner.id, cursor);
    const gifts = result.gifts.map(toGiftView);
    // O dono nem consulta reservations. Ausência dos campos no payload é a
    // garantia: ocultar só o indicador visual ainda revelaria a surpresa.
    if (user !== owner.id && gifts.length) {
      const rows = await unit.availability(group.id, group.type === "secret_santa" ? group.activeDrawId : null, gifts.map((gift) => gift.id));
      const byGift = new Map(rows.map((row) => [row.giftId, row.reservedBy]));
      return {
        group: { id: group.id, name: group.name, type: group.type }, owner: { id: owner.id, name: owner.name }, nextCursor: result.nextCursor,
        gifts: gifts.map((gift) => ({ ...gift, availability: byGift.has(gift.id) ? "reserved" : "available", canCancel: byGift.get(gift.id) === user })),
      };
    }
    return { group: { id: group.id, name: group.name, type: group.type }, owner: { id: owner.id, name: owner.name }, gifts, nextCursor: result.nextCursor };
  }
  async function mutate(operation: "reserve" | "cancel", actor: string | null, groupId: unknown, ownerId: unknown, giftId: unknown) {
    const user = identity(actor);
    const path = reservationPathSchema.safeParse({ groupId, ownerId, giftId });
    if (!path.success) notFound();
    const target = path.data;
    return repository.transaction(async (unit) => {
      // As mutações do grupo e as reservas disputam o mesmo documento. Depois
      // desse lock lógico, cada tentativa transacional relê as permissões atuais.
      const group = await groupFor(unit, user, target.groupId, true);
      await authorize(unit, group, user, target.ownerId);
      if (user === target.ownerId) throw new ReservationError("forbidden", "Você não pode reservar ou cancelar reservas dos seus próprios presentes.");
      // A escrita no presente também conflita com sua exclusão. Só ler o item
      // permitiria inserir uma reserva após a remoção concorrente do presente.
      const gift = await unit.lockGift(target.giftId);
      if (!gift || gift.ownerId !== target.ownerId) notFound();
      const drawId = group.type === "secret_santa" ? group.activeDrawId : null;
      if (operation === "reserve") {
        await unit.insert({ groupId: group.id, giftId: gift.id, ownerId: gift.ownerId, reservedBy: user, drawId, createdAt: new Date() });
      } else if (!await unit.cancel(group.id, drawId, gift.id, user)) notFound();
      return { groupType: group.type };
    });
  }
  return {
    /** Retorna apenas o destinatário do próprio usuário para montar links na UI.
     * Não recebe giverId e não publica edição, coleção de atribuições ou reservantes. */
    async context(actor: string | null, groupId: unknown) {
      const user = identity(actor), parsed = giftIdSchema.safeParse(groupId);
      if (!parsed.success) notFound();
      return repository.transaction(async (unit) => {
        const group = await groupFor(unit, user, parsed.data);
        const recipientId = group.type === "secret_santa" && group.activeDrawId ? await unit.recipient(group, user) : null;
        return { recipientId: recipientId && await unit.isMember(group.id, recipientId) ? recipientId : null };
      });
    },
    async secretSanta(actor: string | null, groupId: unknown, query: unknown = {}): Promise<SecretSantaView> {
      const user = identity(actor), id = giftIdSchema.safeParse(groupId), page = wishlistQuerySchema.safeParse(query);
      if (!id.success) notFound();
      if (!page.success) throw new ReservationError("invalid", "Página de presentes inválida.");
      return repository.transaction(async (unit) => {
        const group = await groupFor(unit, user, id.data);
        if (group.type !== "secret_santa") notFound();
        if (!group.activeDrawId) return { state: "pending", group: { id: group.id, name: group.name, type: group.type } };
        // Sem parâmetro giverId: somente a sessão escolhe qual atribuição ler.
        const recipient = await unit.recipient(group, user);
        if (!recipient || !await unit.isMember(group.id, recipient)) notFound();
        return { state: "drawn", wishlist: await readWishlist(unit, group, user, recipient, page.data.cursor) };
      });
    },
    async list(actor: string | null, groupId: unknown, ownerId: unknown, query: unknown = {}): Promise<WishlistView> {
      const user = identity(actor);
      const path = wishlistPathSchema.safeParse({ groupId, ownerId });
      if (!path.success) notFound();
      const page = wishlistQuerySchema.safeParse(query);
      if (!page.success) throw new ReservationError("invalid", "Página de presentes inválida.");
      return repository.transaction(async (unit) => {
        const group = await groupFor(unit, user, path.data.groupId);
        await authorize(unit, group, user, path.data.ownerId);
        return readWishlist(unit, group, user, path.data.ownerId, page.data.cursor);
      });
    },
    reserve: (actor: string | null, groupId: unknown, ownerId: unknown, giftId: unknown) => mutate("reserve", actor, groupId, ownerId, giftId),
    cancel: (actor: string | null, groupId: unknown, ownerId: unknown, giftId: unknown) => mutate("cancel", actor, groupId, ownerId, giftId),
  };
}
