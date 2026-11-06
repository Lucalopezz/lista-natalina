import type { Group } from "../groups/types";

export type DrawGroup = Pick<Group, "id" | "name" | "type" | "adminId" | "memberCount" | "membershipVersion" | "activeDrawId"> & { drawRevision: number };
export type Assignment = { giverId: string; recipientId: string };
export type DrawStatus = { hasActiveDraw: boolean; revision: number; compositionVersion: number; memberCount: number };
export type DrawActionState = { message: string };
export interface DrawUnit {
  getGroup(id: string): Promise<DrawGroup | null>;
  lockGroup(id: string): Promise<DrawGroup | null>;
  isMember(groupId: string, userId: string): Promise<boolean>;
  members(groupId: string): Promise<string[]>;
  invalidate(groupId: string, drawId: string, now: Date): Promise<boolean>;
  cancelReservations(groupId: string, drawId: string): Promise<void>;
  insertDraw(groupId: string, version: number, actor: string, now: Date): Promise<string>;
  insertAssignments(drawId: string, assignments: Assignment[]): Promise<void>;
  publish(groupId: string, drawId: string | null, now: Date): Promise<void>;
}
export interface DrawRepository {
  transaction<T>(work: (unit: DrawUnit) => Promise<T>): Promise<T>;
}
