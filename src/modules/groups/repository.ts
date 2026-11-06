import "server-only";
import { MongoServerError, ObjectId, type ClientSession, type Db, type MongoClient } from "mongodb";
import { cancelActiveReservations } from "../reservations/persistence";
import { GroupError } from "./service";
import type { Group, GroupChanges, GroupReads, GroupRepository, GroupTransaction, Member, Page } from "./types";

type GroupDocument = Omit<Group, "id" | "adminId" | "activeDrawId"> & { _id: ObjectId; adminId: ObjectId; activeDrawId: ObjectId | null };
type MembershipDocument = { _id: ObjectId; groupId: ObjectId; userId: ObjectId; joinedAt: Date };
const projection = { _id: 1, name: 1, description: 1, type: 1, adminId: 1, memberCount: 1, membershipVersion: 1, writeVersion: 1, activeDrawId: 1, createdAt: 1, updatedAt: 1 };
const pageSize = 24;
const oid = (id: string) => new ObjectId(id);
function entity(document: GroupDocument): Group {
  return {
    id: document._id.toHexString(), name: document.name, description: document.description,
    type: document.type, adminId: document.adminId.toHexString(), memberCount: document.memberCount,
    membershipVersion: document.membershipVersion, writeVersion: document.writeVersion,
    activeDrawId: document.activeDrawId?.toHexString() ?? null,
    createdAt: document.createdAt, updatedAt: document.updatedAt,
  };
}
async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof GroupError) throw error;
    if (error instanceof MongoServerError && error.code === 11000) throw new GroupError("conflict", "Este usuário já participa do grupo.");
    throw new Error("Não foi possível acessar os grupos agora.");
  }
}
function page<T>(items: T[], limit: number, id: (item: T) => string): Page<T> {
  const visible = items.slice(0, limit);
  return { items: visible, nextCursor: items.length > limit ? id(visible.at(-1)!) : null };
}
export async function ensureGroupIndexes(db: Db) {
  await Promise.all([
    db.collection("groups").createIndex({ adminId: 1 }),
    db.collection("memberships").createIndex({ groupId: 1, userId: 1 }, { unique: true }),
    db.collection("memberships").createIndex({ userId: 1, groupId: -1 }),
    db.collection("user").createIndex({ name: 1 }),
  ]);
}

export function createMongoGroupRepository(db: Db, client: MongoClient): GroupRepository {
  const groups = db.collection<GroupDocument>("groups");
  const memberships = db.collection<MembershipDocument>("memberships");
  function unit(session: ClientSession): GroupTransaction {
    return {
      ...readers(session),
      lock: async (id) => {
        // Todas as mutações disputam a mesma escrita antes de validar o snapshot.
        // Em conflito, withTransaction repete o callback e as permissões são relidas.
        // writeVersion coordena operações; membershipVersion muda só com composição.
        const document = await groups.findOneAndUpdate({ _id: oid(id) }, { $inc: { writeVersion: 1 } }, { session, returnDocument: "after", projection });
        return document ? entity(document) : null;
      },
      userExists: async (id) => Boolean(await db.collection("user").findOne({ _id: oid(id) }, { session, projection: { _id: 1 } })),
      isMember: async (groupId, userId) => Boolean(await memberships.findOne({ groupId: oid(groupId), userId: oid(userId) }, { session, projection: { _id: 1 } })),
      insertGroup: async (group) => {
        const document: GroupDocument = { ...group, _id: new ObjectId(), adminId: oid(group.adminId), activeDrawId: group.activeDrawId ? oid(group.activeDrawId) : null };
        await groups.insertOne(document, { session });
        return entity(document);
      },
      insertMember: async (groupId, userId, joinedAt) => { await memberships.insertOne({ _id: new ObjectId(), groupId: oid(groupId), userId: oid(userId), joinedAt }, { session }); },
      patch: async (id, changes: GroupChanges) => {
        const { adminId, ...other } = changes;
        const data = { ...other, ...(adminId ? { adminId: oid(adminId) } : {}) };
        await groups.updateOne({ _id: oid(id) }, { $set: data }, { session });
      },
      removeMember: async (groupId, userId) => {
        await memberships.deleteOne({ groupId: oid(groupId), userId: oid(userId) }, { session });
        // Quem sai perde reservas como comprador e como dono neste grupo. Outros
        // grupos continuam independentes; ownerId veio do presente na criação.
        await cancelActiveReservations(db, { groupId: oid(groupId), $or: [{ reservedBy: oid(userId) }, { ownerId: oid(userId) }] }, session);
      },
      deleteGroup: async (id) => {
        await cancelActiveReservations(db, { groupId: oid(id) }, session);
        await memberships.deleteMany({ groupId: oid(id) }, { session });
        await groups.deleteOne({ _id: oid(id) }, { session });
      },
    };
  }
  function readers(session?: ClientSession): GroupReads {
    return {
      getForMember: (actor, id) => safe(async () => {
        const documents = await groups.aggregate<GroupDocument>([
          { $match: { _id: oid(id) } },
          { $lookup: { from: "memberships", let: { group: "$_id" }, pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$groupId", "$$group"] }, { $eq: ["$userId", oid(actor)] }] } } },
            { $project: { _id: 1 } }, { $limit: 1 },
          ], as: "access" } },
          { $match: { "access.0": { $exists: true } } }, { $project: projection },
        ], { session }).toArray();
        return documents[0] ? entity(documents[0]) : null;
      }),
      listMembers: (groupId, cursor) => safe(async () => {
        const documents = await memberships.aggregate<Member>([
          { $match: { groupId: oid(groupId), ...(cursor ? { userId: { $gt: oid(cursor) } } : {}) } },
          { $sort: { userId: 1 } }, { $limit: pageSize + 1 },
          // A projeção ocorre dentro do lookup: senha/email nem entram no resultado.
          { $lookup: { from: "user", localField: "userId", foreignField: "_id", pipeline: [{ $project: { name: 1 } }], as: "publicUser" } },
          { $unwind: { path: "$publicUser", preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, id: { $toString: "$userId" }, name: { $ifNull: ["$publicUser.name", "Conta indisponível"] } } },
        ], { session }).toArray();
        return page(documents, pageSize, (member) => member.id);
      }),
      searchCandidates: (groupId, query, cursor) => safe(async () => {
        const literalPrefix = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const documents = await db.collection("user").aggregate<Member>([
          { $match: { name: { $regex: `^${literalPrefix}`, $options: "i" }, ...(cursor ? { _id: { $gt: oid(cursor) } } : {}) } },
          { $sort: { _id: 1 } },
          { $lookup: { from: "memberships", let: { user: "$_id" }, pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$groupId", oid(groupId)] }, { $eq: ["$userId", "$$user"] }] } } },
            { $project: { _id: 1 } }, { $limit: 1 },
          ], as: "alreadyMember" } },
          { $match: { "alreadyMember.0": { $exists: false } } }, { $limit: 21 },
          { $project: { _id: 0, id: { $toString: "$_id" }, name: 1 } },
        ], { maxTimeMS: 2000, session }).toArray();
        return page(documents, 20, (user) => user.id);
      }),
    };
  }
  return {
    transaction: <T>(work: (transaction: GroupTransaction) => Promise<T>) => safe(async () => {
      const session = client.startSession();
      try {
        // Sem efeitos externos no callback: o driver pode repeti-lo. Índices são
        // preparados antes da transação, e a publicação acontece somente no commit.
        return await session.withTransaction(() => work(unit(session)), {
          readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
        });
      } finally { await session.endSession(); }
    }),
    ...readers(),
    listForMember: (actor, cursor, onlyDrawn = false) => safe(async () => {
      const documents = await memberships.aggregate<GroupDocument>([
        { $match: { userId: oid(actor), ...(cursor ? { groupId: { $lt: oid(cursor) } } : {}) } },
        { $sort: { groupId: -1 } }, ...(!onlyDrawn ? [{ $limit: pageSize + 1 }] : []),
        { $lookup: { from: "groups", localField: "groupId", foreignField: "_id", pipeline: [...(onlyDrawn ? [{ $match: { type: "secret_santa", activeDrawId: { $type: "objectId" } } }] : []), { $project: projection }], as: "group" } },
        { $unwind: "$group" }, { $replaceRoot: { newRoot: "$group" } },
        // No filtro de sorteios, limitar antes do lookup perderia grupos ativos
        // antigos por causa de grupos convencionais recentes na mesma página.
        ...(onlyDrawn ? [{ $limit: pageSize + 1 }] : []),
      ]).toArray();
      return page(documents.map(entity), pageSize, (group) => group.id);
    }),
  };
}
