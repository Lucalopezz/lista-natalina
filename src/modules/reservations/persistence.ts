import "server-only";
import type { ClientSession, Db, Filter, ObjectId } from "mongodb";

export type ReservationDocument = {
  _id: ObjectId; groupId: ObjectId; giftId: ObjectId; ownerId: ObjectId;
  reservedBy: ObjectId; drawId?: ObjectId; status: "active" | "cancelled";
  createdAt: Date; updatedAt: Date; cancelledAt?: Date;
};

/** Cancelamento sistêmico compartilhado pelos repositórios. O chamador já
 * coordenou o grupo ou o presente e passa sua sessão: a perda de acesso e a
 * mudança das reservas precisam publicar no mesmo commit, sem janela intermediária. */
export async function cancelActiveReservations(db: Db, filter: Filter<ReservationDocument>, session: ClientSession) {
  const now = new Date();
  await db.collection<ReservationDocument>("reservations").updateMany(
    { ...filter, status: "active" },
    { $set: { status: "cancelled", updatedAt: now, cancelledAt: now } },
    { session },
  );
}
