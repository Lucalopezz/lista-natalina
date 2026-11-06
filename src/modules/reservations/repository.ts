import "server-only";
import { MongoServerError, ObjectId, type ClientSession, type Db, type MongoClient } from "mongodb";
import { giftEntity, giftProjection, type GiftDocument } from "../gifts/repository";
import { ReservationError } from "./service";
import type { AccessGroup, ReservationRepository, ReservationUnit } from "./types";
import type { ReservationDocument } from "./persistence";

type GroupDocument = Omit<AccessGroup, "id" | "activeDrawId"> & { _id: ObjectId; activeDrawId?: ObjectId | null; writeVersion?: number };
const oid = (id: string) => new ObjectId(id);
const groupProjection = { name: 1, type: 1, membershipVersion: 1, activeDrawId: 1 };
const drawFilter = (drawId: string | null) => drawId ? { drawId: oid(drawId) } : { drawId: { $exists: false } };
function groupView(group: GroupDocument): AccessGroup {
  return { id: group._id.toHexString(), name: group.name, type: group.type, membershipVersion: group.membershipVersion, activeDrawId: group.activeDrawId?.toHexString() ?? null };
}

export async function ensureReservationIndexes(db: Db) {
  await Promise.all([
    // Edição não entra na chave: mesmo durante troca de edição, nunca há duas
    // reservas ativas do mesmo presente no mesmo grupo. Outros grupos são livres.
    db.collection("reservations").createIndex({ groupId: 1, giftId: 1 }, { unique: true, partialFilterExpression: { status: "active" } }),
    db.collection("reservations").createIndex({ groupId: 1, drawId: 1, status: 1 }),
    db.collection("reservations").createIndex({ groupId: 1, reservedBy: 1, status: 1 }),
    db.collection("reservations").createIndex({ groupId: 1, ownerId: 1, status: 1 }),
    db.collection("reservations").createIndex({ giftId: 1, status: 1 }),
    // A leitura da política exige unicidade do resultado individual. Preparar
    // estes índices não realiza sorteio; a escrita das edições pertence à Fase 6.
    db.collection("draws").createIndex({ groupId: 1 }, { unique: true, partialFilterExpression: { status: "active" } }),
    db.collection("assignments").createIndex({ drawId: 1, giverId: 1 }, { unique: true }),
    db.collection("assignments").createIndex({ drawId: 1, recipientId: 1 }, { unique: true }),
  ]);
}

/** Persistência contextual; nenhuma consulta retorna documentos de auth ou o
 * conjunto de atribuições. A mesma sessão inclui autorização e dados do snapshot. */
export function createMongoReservationRepository(db: Db, client: MongoClient): ReservationRepository {
  const groups = db.collection<GroupDocument>("groups");
  const gifts = db.collection<GiftDocument>("gifts");
  const reservations = db.collection<ReservationDocument>("reservations");
  function unit(session: ClientSession): ReservationUnit {
    return {
      getGroup: async (id) => {
        const group = await groups.findOne({ _id: oid(id) }, { session, projection: groupProjection });
        return group ? groupView(group) : null;
      },
      lockGroup: async (id) => {
        const group = await groups.findOneAndUpdate({ _id: oid(id) }, { $inc: { writeVersion: 1 } }, { session, returnDocument: "after", projection: groupProjection });
        return group ? groupView(group) : null;
      },
      isMember: async (groupId, userId) => Boolean(await db.collection("memberships").findOne({ groupId: oid(groupId), userId: oid(userId) }, { session, projection: { _id: 1 } })),
      recipient: async (group, actor) => {
        if (!group.activeDrawId) return null;
        // Não basta existir uma atribuição antiga: edição, grupo, estado e
        // composição precisam corresponder ao ponteiro atual do grupo.
        const draw = await db.collection("draws").findOne({ _id: oid(group.activeDrawId), groupId: oid(group.id), status: "active", membershipVersion: group.membershipVersion }, { session, projection: { _id: 1 } });
        if (!draw) return null;
        const assignment = await db.collection<{ drawId: ObjectId; giverId: ObjectId; recipientId: ObjectId }>("assignments").findOne(
          { drawId: draw._id, giverId: oid(actor) }, { session, projection: { recipientId: 1 } },
        );
        return assignment && !assignment.recipientId.equals(oid(actor)) ? assignment.recipientId.toHexString() : null;
      },
      profile: async (id) => {
        const user = await db.collection<{ _id: ObjectId; name: string }>("user").findOne({ _id: oid(id) }, { session, projection: { name: 1 } });
        return user ? { id: user._id.toHexString(), name: user.name } : null;
      },
      listGifts: async (ownerId, cursor) => {
        const documents = await gifts.find({ ownerId: oid(ownerId), ...(cursor ? { _id: { $lt: oid(cursor) } } : {}) }, { session, projection: giftProjection }).sort({ _id: -1 }).limit(25).toArray();
        const items = documents.slice(0, 24).map(giftEntity);
        return { gifts: items, nextCursor: documents.length > 24 ? items.at(-1)!.id : null };
      },
      lockGift: async (id) => {
        const gift = await gifts.findOneAndUpdate({ _id: oid(id) }, { $inc: { reservationVersion: 1 } }, { session, returnDocument: "after", projection: giftProjection });
        return gift ? giftEntity(gift) : null;
      },
      availability: async (groupId, drawId, giftIds) => {
        const documents = await reservations.find({ groupId: oid(groupId), giftId: { $in: giftIds.map(oid) }, status: "active", ...drawFilter(drawId) }, { session, projection: { _id: 0, giftId: 1, reservedBy: 1 } }).toArray();
        return documents.map((row) => ({ giftId: row.giftId.toHexString(), reservedBy: row.reservedBy.toHexString() }));
      },
      insert: async (input) => {
        await reservations.insertOne({
          _id: new ObjectId(), groupId: oid(input.groupId), giftId: oid(input.giftId), ownerId: oid(input.ownerId), reservedBy: oid(input.reservedBy),
          ...(input.drawId ? { drawId: oid(input.drawId) } : {}), status: "active", createdAt: input.createdAt, updatedAt: input.createdAt,
        }, { session });
      },
      cancel: async (groupId, drawId, giftId, actor) => {
        const now = new Date();
        // O reservante faz parte do filtro atômico; nem admin cancela por outro.
        const result = await reservations.updateOne({ groupId: oid(groupId), giftId: oid(giftId), reservedBy: oid(actor), status: "active", ...drawFilter(drawId) }, { $set: { status: "cancelled", updatedAt: now, cancelledAt: now } }, { session });
        return result.modifiedCount === 1;
      },
    };
  }
  return {
    async transaction(work) {
      const session = client.startSession();
      try {
        return await session.withTransaction(() => work(unit(session)), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } catch (error) {
        if (error instanceof ReservationError) throw error;
        if (error instanceof MongoServerError && error.code === 11000) throw new ReservationError("unavailable", "Este presente já está reservado neste grupo. Atualize a lista.");
        // Não propagar detalhes brutos do driver: podem conter configuração privada.
        throw new Error("Não foi possível acessar as listas e reservas agora. Tente novamente.");
      } finally { await session.endSession(); }
    },
  };
}
