import type { GroupInfo, GroupType } from "./validation";

export type Group = GroupInfo & {
  id: string; type: GroupType; adminId: string; memberCount: number;
  membershipVersion: number; writeVersion: number; activeDrawId: string | null;
  createdAt: Date; updatedAt: Date;
};
export type GroupView = Pick<Group, "id" | "name" | "description" | "type" | "adminId" | "memberCount"> & {
  hasActiveDraw: boolean; createdAt: string; updatedAt: string;
};
export type Member = { id: string; name: string };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type GroupChanges = Partial<GroupInfo & Pick<Group, "adminId" | "memberCount" | "membershipVersion">> & { updatedAt: Date };
export type GroupActionState = { message: string; fields?: Partial<Record<"name" | "description" | "type", string[]>> };

/** Operações concretas da unidade transacional, usadas pelos casos de uso. */
export interface GroupTransaction {
  lock(id: string): Promise<Group | null>;
  userExists(id: string): Promise<boolean>;
  isMember(groupId: string, userId: string): Promise<boolean>;
  insertGroup(group: Omit<Group, "id">): Promise<Group>;
  insertMember(groupId: string, userId: string, joinedAt: Date): Promise<void>;
  patch(groupId: string, changes: GroupChanges): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
}
export interface GroupRepository {
  transaction<T>(work: (unit: GroupTransaction) => Promise<T>): Promise<T>;
  getForMember(actor: string, id: string): Promise<Group | null>;
  listForMember(actor: string, cursor?: string, onlyDrawn?: boolean): Promise<Page<Group>>;
  listMembers(groupId: string, cursor?: string): Promise<Page<Member>>;
  searchCandidates(groupId: string, query: string, cursor?: string): Promise<Page<Member>>;
}
