import type { Gift, GiftPage, GiftView } from "../gifts/types";
import type { Group } from "../groups/types";

export type AccessGroup = Pick<Group, "id" | "name" | "type" | "membershipVersion" | "activeDrawId">;
export type ReservationInput = { groupId: string; giftId: string; ownerId: string; reservedBy: string; drawId: string | null; createdAt: Date };
export type Availability = { giftId: string; reservedBy: string };
export type GroupGiftView = GiftView & { availability?: "available" | "reserved"; canCancel?: boolean };
export type WishlistView = {
  group: Pick<AccessGroup, "id" | "name" | "type">;
  owner: { id: string; name: string };
  gifts: GroupGiftView[];
  nextCursor: string | null;
};
export type ReservationActionState = { message: string };

/** A unidade mantém autorização e dados no mesmo snapshot; mutações disputam
 * os documentos do grupo e presente antes de publicar qualquer reserva. */
export interface ReservationUnit {
  getGroup(id: string): Promise<AccessGroup | null>;
  lockGroup(id: string): Promise<AccessGroup | null>;
  isMember(groupId: string, userId: string): Promise<boolean>;
  recipient(group: AccessGroup, actor: string): Promise<string | null>;
  profile(id: string): Promise<{ id: string; name: string } | null>;
  listGifts(ownerId: string, cursor?: string): Promise<GiftPage<Gift>>;
  lockGift(id: string): Promise<Gift | null>;
  availability(groupId: string, drawId: string | null, giftIds: string[]): Promise<Availability[]>;
  insert(input: ReservationInput): Promise<void>;
  cancel(groupId: string, drawId: string | null, giftId: string, actor: string): Promise<boolean>;
}
export interface ReservationRepository {
  transaction<T>(work: (unit: ReservationUnit) => Promise<T>): Promise<T>;
}
