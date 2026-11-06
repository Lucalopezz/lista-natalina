import { MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMongoReservationRepository, ensureReservationIndexes } from "./repository";
import { createReservationService } from "./service";
import { createMongoGroupRepository, ensureGroupIndexes } from "../groups/repository";
import { createGroupService } from "../groups/service";
import { createMongoGiftRepository, ensureGiftIndexes } from "../gifts/repository";
import { createGiftService } from "../gifts/service";
import { cancelActiveReservations } from "./persistence";
import type { GroupTransaction } from "../groups/types";
import type { ReservationUnit } from "./types";

vi.mock("server-only", () => ({}));
const uri = process.env.INTEGRATION_DATABASE_URL ?? "";
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/lista_natalina_test\?directConnection=true$/.test(uri)) throw new Error("Use o runner MongoDB descartável.");
const client = new MongoClient(uri), db = client.db("lista_natalina_test_reservations");
const repository = createMongoReservationRepository(db, client), service = createReservationService(repository);
const groupRepository = createMongoGroupRepository(db, client);
const groups = createGroupService(groupRepository);
const gifts = createGiftService(createMongoGiftRepository(db, client));
const a = new ObjectId(), b = new ObjectId(), c = new ObjectId(), stranger = new ObjectId();
const A = a.toHexString(), B = b.toHexString(), C = c.toHexString(), X = stranger.toHexString();
const oid = (id: string) => new ObjectId(id);
const input = { name: "Livro", description: "Receitas", productUrl: "https://example.test/book", imageUrl: "" };
async function setup(type = "conventional") {
  const group = await groups.create(A, { name: "Família", type });
  await groups.add(A, group.id, B); await groups.add(A, group.id, C);
  const gift = await gifts.create(B, input);
  return { group, gift };
}
/** Somente fixtures: não implementa a geração/invalidação de sorteio da Fase 6. */
async function activate(groupId: string) {
  const group = await db.collection("groups").findOne({ _id: oid(groupId) });
  const drawId = new ObjectId();
  await db.collection("draws").insertOne({ _id: drawId, groupId: oid(groupId), status: "active", membershipVersion: group!.membershipVersion });
  await db.collection("assignments").insertMany([
    { drawId, giverId: a, recipientId: b }, { drawId, giverId: b, recipientId: c }, { drawId, giverId: c, recipientId: a },
  ]);
  await db.collection("groups").updateOne({ _id: oid(groupId) }, { $set: { activeDrawId: drawId } });
  return drawId;
}
beforeAll(async () => {
  await client.connect();
  await Promise.all([ensureGroupIndexes(db), ensureGiftIndexes(db), ensureReservationIndexes(db)]);
  await db.collection("user").insertMany([
    { _id: a, name: "Ana", email: "private-a@example.test" }, { _id: b, name: "Bruna", email: "private-b@example.test" },
    { _id: c, name: "Carlos", email: "private-c@example.test" }, { _id: stranger, name: "Pessoa fora", email: "private-x@example.test" },
  ]);
});
afterAll(async () => { await db.dropDatabase(); await client.close(); });

describe("reservas reais e autorização contextual", () => {
  it("lista perfil mínimo e não escreve versões durante consultas", async () => {
    const { group } = await setup();
    const before = await db.collection("groups").findOne({ _id: oid(group.id) });
    const page = await service.list(A, group.id, B);
    expect(page.owner).toEqual({ id: B, name: "Bruna" });
    expect(JSON.stringify(page)).not.toContain("private-");
    const after = await db.collection("groups").findOne({ _id: oid(group.id) });
    expect(after?.writeVersion).toBe(before?.writeVersion);
    await expect(service.list(X, group.id, B)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.list(A, group.id, X)).rejects.toMatchObject({ code: "not_found" });
  });
  it("duas reservas simultâneas do mesmo presente/grupo deixam exatamente uma ativa", async () => {
    const { group, gift } = await setup();
    const results = await Promise.allSettled([service.reserve(A, group.id, B, gift.id), service.reserve(C, group.id, B, gift.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: "unavailable" } });
    expect(await db.collection("reservations").countDocuments({ groupId: oid(group.id), giftId: oid(gift.id), status: "active" })).toBe(1);
  });
  it("mesmo presente tem reservas independentes em dois grupos", async () => {
    const { group, gift } = await setup();
    const other = await groups.create(A, { name: "Amigos", type: "conventional" });
    await groups.add(A, other.id, B); await groups.add(A, other.id, C);
    await service.reserve(A, group.id, B, gift.id);
    expect((await service.list(C, other.id, B)).gifts.find((g) => g.id === gift.id)?.availability).toBe("available");
    await service.reserve(C, other.id, B, gift.id);
    expect(await db.collection("reservations").countDocuments({ giftId: oid(gift.id), status: "active" })).toBe(2);
    await service.cancel(A, group.id, B, gift.id);
    expect((await service.list(A, other.id, B)).gifts.find((g) => g.id === gift.id)).toMatchObject({ availability: "reserved", canCancel: false });
  });
  it("dono não recebe dados de reserva nas duas rotas de leitura", async () => {
    const { group, gift } = await setup(); await service.reserve(A, group.id, B, gift.id);
    const sharedOwn = (await service.list(B, group.id, B)).gifts.find((g) => g.id === gift.id)!;
    const personal = await gifts.get(B, gift.id);
    expect(Object.keys(sharedOwn).sort()).toEqual(Object.keys(personal).sort());
    expect(sharedOwn).not.toHaveProperty("availability"); expect(sharedOwn).not.toHaveProperty("canCancel");
    expect(sharedOwn).not.toHaveProperty("reservationVersion");
    const third = (await service.list(C, group.id, B)).gifts.find((g) => g.id === gift.id)!;
    expect(third).toMatchObject({ availability: "reserved", canCancel: false });
    expect(third).not.toHaveProperty("reservedBy"); expect(third).not.toHaveProperty("drawId");
  });
  it("somente reservante cancela, e depois outra reserva pode ser criada", async () => {
    const { group, gift } = await setup(); await service.reserve(C, group.id, B, gift.id);
    await expect(service.cancel(A, group.id, B, gift.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.reserve(B, group.id, B, gift.id)).rejects.toMatchObject({ code: "forbidden" });
    await service.cancel(C, group.id, B, gift.id); await service.reserve(A, group.id, B, gift.id);
    const history = await db.collection("reservations").find({ groupId: oid(group.id), giftId: oid(gift.id) }).toArray();
    expect(history.map((r) => r.status).sort()).toEqual(["active", "cancelled"]);
    expect(history.some((r) => r.cancelledAt instanceof Date)).toBe(true);
  });
  it("índice parcial impede duplicata ativa inclusive por inserção direta", async () => {
    const { group, gift } = await setup(); await service.reserve(A, group.id, B, gift.id);
    await expect(db.collection("reservations").insertOne({ groupId: oid(group.id), giftId: oid(gift.id), reservedBy: c, ownerId: b, status: "active" })).rejects.toMatchObject({ code: 11000 });
    const index = (await db.collection("reservations").indexes()).find((i) => i.key.groupId === 1 && i.key.giftId === 1);
    expect(index).toMatchObject({ unique: true, partialFilterExpression: { status: "active" } });
  });
  it("outro grupo compartilhado não libera listas no contexto de amigo secreto", async () => {
    const { group, gift } = await setup("secret_santa");
    const conventional = await groups.create(A, { name: "Convencional", type: "conventional" }); await groups.add(A, conventional.id, B);
    await expect(service.list(A, group.id, B)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.reserve(A, group.id, B, gift.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await service.list(A, conventional.id, B)).gifts.some((g) => g.id === gift.id)).toBe(true);
  });
  it("edição ativa libera somente a atribuição da sessão, inclusive para admin", async () => {
    const { group, gift } = await setup("secret_santa"), drawId = await activate(group.id);
    const ownResult = await service.context(A, group.id);
    expect(ownResult).toEqual({ recipientId: B });
    await service.reserve(A, group.id, B, gift.id);
    const raw = await db.collection("reservations").findOne({ groupId: oid(group.id), giftId: oid(gift.id), status: "active" });
    expect(raw?.drawId).toEqual(drawId);
    await expect(service.list(A, group.id, C)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.list(C, group.id, B)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.reserve(C, group.id, B, gift.id)).rejects.toMatchObject({ code: "not_found" });
    expect(JSON.stringify(await service.list(A, group.id, B))).not.toContain(drawId.toHexString());
  });
  it("edição invalidada, de outro grupo ou de composição antiga não autoriza", async () => {
    const { group } = await setup("secret_santa"), drawId = await activate(group.id);
    await db.collection("draws").updateOne({ _id: drawId }, { $set: { status: "invalidated" } });
    await expect(service.list(A, group.id, B)).rejects.toMatchObject({ code: "not_found" });
    await db.collection("draws").updateOne({ _id: drawId }, { $set: { status: "active", groupId: new ObjectId() } });
    await expect(service.list(A, group.id, B)).rejects.toMatchObject({ code: "not_found" });
    await db.collection("draws").updateOne({ _id: drawId }, { $set: { groupId: oid(group.id), membershipVersion: 999 } });
    await expect(service.list(A, group.id, B)).rejects.toMatchObject({ code: "not_found" });
  });
  it("falha após inserir reserva faz rollback de reserva e versões", async () => {
    const { group, gift } = await setup();
    const before = await db.collection("groups").findOne({ _id: oid(group.id) });
    const failing = createReservationService({ transaction: <T>(work: (unit: ReservationUnit) => Promise<T>) => repository.transaction((unit) => work({ ...unit, insert: async (data) => { await unit.insert(data); throw new Error("fixture-private-error"); } })) });
    await expect(failing.reserve(A, group.id, B, gift.id)).rejects.toThrow("Não foi possível acessar");
    expect(await db.collection("reservations").countDocuments({ groupId: oid(group.id) })).toBe(0);
    expect((await db.collection("groups").findOne({ _id: oid(group.id) }))?.writeVersion).toBe(before?.writeVersion);
    expect((await db.collection("gifts").findOne({ _id: oid(gift.id) }))?.reservationVersion).toBeUndefined();
  });
  it.each(["leave_buyer", "leave_owner", "remove_buyer", "remove_owner", "delete_gift"])("reserva concorrente com %s não sobrevive à perda de acesso", async (operation) => {
    const { group, gift } = await setup();
    const revoke = operation === "leave_buyer" ? () => groups.leave(C, group.id)
      : operation === "leave_owner" ? () => groups.leave(B, group.id)
      : operation === "remove_buyer" ? () => groups.remove(A, group.id, C)
      : operation === "remove_owner" ? () => groups.remove(A, group.id, B) : () => gifts.remove(B, gift.id);
    const results = await Promise.allSettled([service.reserve(C, group.id, B, gift.id), revoke()]);
    expect(results[1].status).toBe("fulfilled");
    expect(await db.collection("reservations").countDocuments({ groupId: oid(group.id), giftId: oid(gift.id), status: "active" })).toBe(0);
  });
  it("falha depois da remoção e do cancelamento desfaz ambos", async () => {
    const { group, gift } = await setup(); await service.reserve(C, group.id, B, gift.id);
    const failing = createGroupService({ ...groupRepository, transaction: <T>(work: (unit: GroupTransaction) => Promise<T>) => groupRepository.transaction((unit) => work({ ...unit, patch: async () => { throw new Error("fixture-after-cleanup"); } })) });
    await expect(failing.remove(A, group.id, C)).rejects.toThrow("Não foi possível acessar os grupos");
    expect(await db.collection("memberships").findOne({ groupId: oid(group.id), userId: c })).toBeTruthy();
    expect(await db.collection("reservations").countDocuments({ groupId: oid(group.id), giftId: oid(gift.id), status: "active" })).toBe(1);
  });
  it("reserva concorre com fixture de invalidação sem sobreviver à edição inválida", async () => {
    const { group, gift } = await setup("secret_santa"), drawId = await activate(group.id);
    const invalidateFixture = async () => {
      const session = client.startSession();
      try {
        // Fixture do protocolo futuro: não é um caso de uso de sorteio entregue.
        // A Fase 6 precisa usar esta mesma coordenação e cancelamento atômico.
        await session.withTransaction(async () => {
          await db.collection("groups").updateOne({ _id: oid(group.id) }, { $inc: { writeVersion: 1 }, $set: { activeDrawId: null } }, { session });
          await db.collection("draws").updateOne({ _id: drawId }, { $set: { status: "invalidated" } }, { session });
          await cancelActiveReservations(db, { groupId: oid(group.id), drawId }, session);
        });
      } finally { await session.endSession(); }
    };
    const results = await Promise.allSettled([service.reserve(A, group.id, B, gift.id), invalidateFixture()]);
    expect(results[1].status).toBe("fulfilled");
    expect(await db.collection("reservations").countDocuments({ groupId: oid(group.id), drawId, status: "active" })).toBe(0);
    await expect(service.list(A, group.id, B)).rejects.toMatchObject({ code: "not_found" });
  });
  it("encerramento cancela reservas remanescentes sem apagar histórico", async () => {
    const group = await groups.create(A, { name: "Último membro", type: "conventional" });
    await db.collection("reservations").insertOne({ groupId: oid(group.id), giftId: new ObjectId(), ownerId: b, reservedBy: a, status: "active" });
    await groups.close(A, group.id);
    expect((await db.collection("reservations").findOne({ groupId: oid(group.id) }))?.status).toBe("cancelled");
  });
  it("pagina a lista completa e não confunde reserva de outra página", async () => {
    const { group } = await setup();
    for (let i = 0; i < 26; i++) await gifts.create(B, { ...input, name: `Item ${i}` });
    const first = await service.list(A, group.id, B);
    const next = await service.list(A, group.id, B, { cursor: first.nextCursor });
    expect(first.gifts).toHaveLength(24); expect(next.gifts.length).toBeGreaterThan(0);
    expect(new Set([...first.gifts, ...next.gifts].map((g) => g.id)).size).toBe(first.gifts.length + next.gifts.length);
    await service.reserve(A, group.id, B, next.gifts[0].id);
    expect((await service.list(C, group.id, B, { cursor: first.nextCursor })).gifts[0]).toMatchObject({ availability: "reserved", canCancel: false });
  });
});
