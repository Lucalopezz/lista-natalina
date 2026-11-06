import "server-only";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import { cancelActiveReservations } from "../reservations/persistence";
import type { Gift, GiftRepository } from "./types";

export type GiftDocument = Omit<Gift, "id" | "ownerId"> & { _id: ObjectId; ownerId: ObjectId; reservationVersion?: number };
export const giftProjection = { _id: 1, ownerId: 1, name: 1, description: 1, productUrl: 1, imageUrl: 1, createdAt: 1, updatedAt: 1 };
const pageSize = 24;

export function giftEntity(document: GiftDocument): Gift {
  return {
    id: document._id.toHexString(), ownerId: document.ownerId.toHexString(),
    name: document.name, description: document.description,
    productUrl: document.productUrl, imageUrl: document.imageUrl,
    createdAt: document.createdAt, updatedAt: document.updatedAt,
  };
}

/** Evita que o framework registre erros brutos do driver com dados de conexão. */
async function persist<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch { throw new Error("Não foi possível acessar os presentes agora."); }
}

export async function ensureGiftIndexes(db: Db) {
  await db.collection("gifts").createIndex({ ownerId: 1, _id: -1 });
}

export function createMongoGiftRepository(db: Db, client: MongoClient): GiftRepository {
  const gifts = db.collection<GiftDocument>("gifts");
  const owned = (ownerId: string, id: string) => ({ _id: new ObjectId(id), ownerId: new ObjectId(ownerId) });
  return {
    insert: (gift) => persist(async () => {
      const document: GiftDocument = { ...gift, _id: new ObjectId(), ownerId: new ObjectId(gift.ownerId) };
      await gifts.insertOne(document);
      return giftEntity(document);
    }),
    findOwned: (ownerId, id) => persist(async () => {
      const document = await gifts.findOne(owned(ownerId, id), { projection: giftProjection });
      return document ? giftEntity(document) : null;
    }),
    listOwned: (ownerId, cursor) => persist(async () => {
      // O cursor é o _id, que permanece estável ao editar o presente. O filtro
      // ownerId está sempre presente, inclusive se o cursor for de outro usuário.
      // Buscar um item extra detecta a próxima página sem contar toda a coleção.
      const documents = await gifts.find({
        ownerId: new ObjectId(ownerId), ...(cursor ? { _id: { $lt: new ObjectId(cursor) } } : {}),
      }, { projection: giftProjection }).sort({ _id: -1 }).limit(pageSize + 1).toArray();
      const items = documents.slice(0, pageSize).map(giftEntity);
      return { gifts: items, nextCursor: documents.length > pageSize ? items.at(-1)!.id : null };
    }),
    updateOwned: (ownerId, id, input) => persist(async () => {
      // ID e dono são verificados pelo próprio update atômico. Não há janela entre
      // consultar autorização e escrever, nem caminho para trocar o proprietário.
      const document = await gifts.findOneAndUpdate(owned(ownerId, id), { $set: input }, { returnDocument: "after", projection: giftProjection });
      return document ? giftEntity(document) : null;
    }),
    deleteOwned: (ownerId, id) => persist(async () => {
      const session = client.startSession();
      try {
        return await session.withTransaction(async () => {
          // A exclusão disputa a mesma escrita usada ao reservar. Assim uma
          // reserva concorrente termina antes do cancelamento ou relê o item
          // já excluído; nunca nasce uma reserva ativa para um presente ausente.
          const gift = await gifts.findOneAndUpdate(owned(ownerId, id), { $inc: { reservationVersion: 1 } }, { session, projection: { _id: 1 } });
          if (!gift) return false;
          await cancelActiveReservations(db, { giftId: new ObjectId(id) }, session);
          await gifts.deleteOne(owned(ownerId, id), { session });
          return true;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    }),
  };
}
