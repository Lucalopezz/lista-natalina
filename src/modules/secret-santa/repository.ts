import "server-only";
import { MongoServerError, ObjectId, type ClientSession, type Db, type MongoClient } from "mongodb";
import { ensureReservationIndexes } from "../reservations/repository";
import { cancelActiveReservations } from "../reservations/persistence";
import { DrawError } from "./service";
import type { DrawGroup, DrawRepository, DrawUnit } from "./types";

type GroupDocument = Omit<DrawGroup, "id" | "adminId" | "activeDrawId"> & { _id: ObjectId; adminId: ObjectId; activeDrawId: ObjectId | null; writeVersion?: number };
const oid = (id: string) => new ObjectId(id);
const projection = { name: 1, type: 1, adminId: 1, memberCount: 1, membershipVersion: 1, activeDrawId: 1, drawRevision: 1 };
function entity(group: GroupDocument): DrawGroup {
  return { id: group._id.toHexString(), name: group.name, type: group.type, adminId: group.adminId.toHexString(), memberCount: group.memberCount, membershipVersion: group.membershipVersion, activeDrawId: group.activeDrawId?.toHexString() ?? null, drawRevision: group.drawRevision ?? 0 };
}
export async function ensureDrawIndexes(db: Db) {
  await ensureReservationIndexes(db);
  await db.collection("draws").createIndex({ groupId: 1, createdAt: -1 });
}

/** Coordena os mesmos documentos que reservas e alterações de participantes.
 * Callback pode ser repetido pelo driver; somente o commit publica os resultados. */
export function createMongoDrawRepository(db: Db, client: MongoClient): DrawRepository {
  const groups = db.collection<GroupDocument>("groups");
  function unit(session: ClientSession): DrawUnit {
    return {
      getGroup: async (id) => { const group = await groups.findOne({ _id: oid(id) }, { session, projection }); return group ? entity(group) : null; },
      lockGroup: async (id) => {
        const group = await groups.findOneAndUpdate({ _id: oid(id) }, { $inc: { writeVersion: 1 } }, { session, returnDocument: "after", projection });
        return group ? entity(group) : null;
      },
      isMember: async (groupId, userId) => Boolean(await db.collection("memberships").findOne({ groupId: oid(groupId), userId: oid(userId) }, { session, projection: { _id: 1 } })),
      members: async (groupId) => {
        // Sem limite de página: o sorteio usa a composição inteira. O lookup
        // confere contas existentes sem carregar email/senha nos resultados.
        const members = await db.collection("memberships").aggregate<{ userId: ObjectId }>([
          { $match: { groupId: oid(groupId) } }, { $sort: { userId: 1 } },
          { $lookup: { from: "user", localField: "userId", foreignField: "_id", pipeline: [{ $project: { _id: 1 } }], as: "user" } },
          { $match: { "user.0": { $exists: true } } }, { $project: { userId: 1 } },
        ], { session }).toArray();
        return members.map((member) => member.userId.toHexString());
      },
      invalidate: async (groupId, drawId, now) => {
        const result = await db.collection("draws").updateOne({ _id: oid(drawId), groupId: oid(groupId), status: "active" }, { $set: { status: "invalidated", invalidatedAt: now } }, { session });
        return result.modifiedCount === 1;
      },
      cancelReservations: (groupId, drawId) => cancelActiveReservations(db, { groupId: oid(groupId), drawId: oid(drawId) }, session),
      insertDraw: async (groupId, version, actor, now) => {
        const drawId = new ObjectId();
        await db.collection("draws").insertOne({ _id: drawId, groupId: oid(groupId), membershipVersion: version, status: "active", createdBy: oid(actor), createdAt: now }, { session });
        return drawId.toHexString();
      },
      insertAssignments: async (drawId, pairs) => {
        await db.collection("assignments").insertMany(pairs.map((pair) => ({ _id: new ObjectId(), drawId: oid(drawId), giverId: oid(pair.giverId), recipientId: oid(pair.recipientId) })), { session });
      },
      publish: async (groupId, drawId, now) => {
        // drawRevision não depende de reservas. Ausência em grupos antigos vale
        // zero, sem migração destrutiva; o primeiro incremento cria o campo.
        await groups.updateOne({ _id: oid(groupId) }, { $set: { activeDrawId: drawId ? oid(drawId) : null, updatedAt: now }, $inc: { drawRevision: 1 } }, { session });
      },
    };
  }
  return {
    async transaction(work) {
      const session = client.startSession();
      try { return await session.withTransaction(() => work(unit(session)), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }); }
      catch (error) {
        if (error instanceof DrawError) throw error;
        if (error instanceof MongoServerError && error.code === 11000) throw new DrawError("stale", "O sorteio mudou. Atualize o grupo e confira o estado atual.");
        throw new Error("Não foi possível alterar o sorteio agora. Tente novamente.");
      } finally { await session.endSession(); }
    },
  };
}
