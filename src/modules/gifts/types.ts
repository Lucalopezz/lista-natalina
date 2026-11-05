import type { GiftInput, GiftField } from "./validation";

export type Gift = GiftInput & {
  id: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};
export type GiftView = Omit<Gift, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type GiftPage<T = GiftView> = { gifts: T[]; nextCursor: string | null };
export type GiftActionState = { message: string; fields?: Partial<Record<GiftField, string[]>> };

export interface GiftRepository {
  insert(gift: Omit<Gift, "id">): Promise<Gift>;
  findOwned(ownerId: string, id: string): Promise<Gift | null>;
  listOwned(ownerId: string, cursor?: string): Promise<GiftPage<Gift>>;
  updateOwned(ownerId: string, id: string, input: GiftInput & { updatedAt: Date }): Promise<Gift | null>;
  deleteOwned(ownerId: string, id: string): Promise<boolean>;
}
