import { MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMongoDrawRepository, ensureDrawIndexes } from "./repository";
import { createSecretSantaService } from "./service";
import { createMongoGroupRepository, ensureGroupIndexes } from "../groups/repository";
import { createGroupService } from "../groups/service";
import { createMongoGiftRepository, ensureGiftIndexes } from "../gifts/repository";
import { createGiftService } from "../gifts/service";
import { createMongoReservationRepository } from "../reservations/repository";
import { createReservationService } from "../reservations/service";
import type { DrawUnit } from "./types";

vi.mock("server-only", () => ({}));
const uri = process.env.INTEGRATION_DATABASE_URL ?? "";
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/lista_natalina_test\?directConnection=true$/.test(uri)) throw new Error("Use o runner descartável.");
const client = new MongoClient(uri), db = client.db("lista_natalina_test_draws");
const repository = createMongoDrawRepository(db, client), service = createSecretSantaService(repository);
const groups = createGroupService(createMongoGroupRepository(db, client));
const gifts = createGiftService(createMongoGiftRepository(db, client));
const lists = createReservationService(createMongoReservationRepository(db, client));
const ids = Array.from({ length: 5 }, () => new ObjectId());
const [A, B, C, D, X] = ids.map((id) => id.toHexString());
const oid = (id: string) => new ObjectId(id);
const input = { name: "Livro", description: "Receitas em família", productUrl: "https://example.test/book", imageUrl: "" };
async function setup(count = 3, type = "secret_santa") {
  const group = await groups.create(A, { name: "Natal", type });
  for (const actor of [B, C, D].slice(0, count - 1)) await groups.add(A, group.id, actor);
  for (const actor of [A, B, C, D].slice(0, count)) await gifts.create(actor, input);
  return group.id;
}
const execute = async (id: string, op = "start") => service.execute(A, id, op, await service.status(A, id));
const rawGroup = (id: string) => db.collection("groups").findOne({ _id: oid(id) });
async function ownReservation(actor: string, id: string) {
  const result = await lists.secretSanta(actor, id);
  if (result.state !== "drawn") throw new Error("Fixture sem sorteio");
  const gift = result.wishlist.gifts[0];
  await lists.reserve(actor, id, gift.ownerId, gift.id);
  return gift;
}
beforeAll(async () => {
  await client.connect(); await Promise.all([ensureGroupIndexes(db), ensureGiftIndexes(db), ensureDrawIndexes(db)]);
  await db.collection("user").insertMany(ids.map((id, i) => ({ _id: id, name: `Pessoa ${i}`, email: `private-${i}@example.test` })));
});
afterAll(async () => { await db.dropDatabase(); await client.close(); });

describe("sorteios persistidos e concorrência", () => {
  it("persiste edição e bijeção sem autoatribuição no mesmo commit", async () => {
    const id = await setup(); await execute(id);
    const group = await rawGroup(id), draw = await db.collection("draws").findOne({ _id: group!.activeDrawId });
    const pairs = await db.collection("assignments").find({ drawId: draw!._id }).toArray();
    expect(draw).toMatchObject({ groupId: oid(id), status: "active", membershipVersion: group!.membershipVersion, createdBy: oid(A) });
    expect(pairs).toHaveLength(3);
    expect(new Set(pairs.map((p) => p.giverId.toHexString()))).toEqual(new Set([A, B, C]));
    expect(new Set(pairs.map((p) => p.recipientId.toHexString()))).toEqual(new Set([A, B, C]));
    expect(pairs.every((p) => !p.giverId.equals(p.recipientId))).toBe(true);
  });
  it("mínimo três e tipo são verificados no backend", async () => {
    const id = await setup(2); await expect(execute(id)).rejects.toMatchObject({ code: "insufficient" });
    const conventional = await setup(3, "conventional");
    await expect(service.execute(A, conventional, "start", { revision: 0, compositionVersion: 3 })).rejects.toMatchObject({ code: "invalid" });
    expect((await rawGroup(id))!.activeDrawId).toBeNull();
  });
  it("somente admin muda sorteios; não membro não consulta estado", async () => {
    const id = await setup();
    await expect(service.execute(B, id, "start", await service.status(B, id))).rejects.toMatchObject({ code: "forbidden" });
    await expect(service.status(X, id)).rejects.toMatchObject({ code: "not_found" });
    await execute(id);
    for (const op of ["redraw", "invalidate"]) await expect(service.execute(C, id, op, await service.status(C, id))).rejects.toMatchObject({ code: "forbidden" });
  });
  it("resultado da sessão ignora giverId enviado e não expõe metadados privados", async () => {
    const id = await setup(); await execute(id);
    const result = await lists.secretSanta(A, id, { giverId: B });
    const raw = await rawGroup(id);
    const own = await db.collection("assignments").findOne({ drawId: raw!.activeDrawId, giverId: oid(A) });
    expect(result.state).toBe("drawn");
    if (result.state !== "drawn") throw new Error("Fixture");
    expect(result.wishlist.owner.id).toBe(own!.recipientId.toHexString());
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private-"); expect(serialized).not.toContain(raw!.activeDrawId.toHexString());
    expect(serialized).not.toContain("assignments");
    const forbidden = [B, C].find((member) => member !== result.wishlist.owner.id)!;
    await expect(lists.list(A, id, forbidden)).rejects.toMatchObject({ code: "not_found" });
  });
  it("refazer invalida anterior, cancela suas reservas e preserva outro grupo", async () => {
    const id = await setup(); await execute(id); const gift = await ownReservation(A, id);
    const other = await setup(3, "conventional"); await lists.reserve(A, other, gift.ownerId, gift.id);
    const old = (await rawGroup(id))!.activeDrawId;
    await execute(id, "redraw");
    const current = (await rawGroup(id))!.activeDrawId;
    expect(current.equals(old)).toBe(false);
    expect((await db.collection("draws").findOne({ _id: old }))?.status).toBe("invalidated");
    expect(await db.collection("reservations").countDocuments({ groupId: oid(id), drawId: old, status: "active" })).toBe(0);
    expect(await db.collection("reservations").countDocuments({ groupId: oid(other), status: "active" })).toBe(1);
    expect(await db.collection("assignments").countDocuments({ drawId: old })).toBe(3);
    const result = await lists.secretSanta(A, id);
    const own = await db.collection("assignments").findOne({ drawId: current, giverId: oid(A) });
    expect(result).toMatchObject({ state: "drawn", wishlist: { owner: { id: own!.recipientId.toHexString() } } });
  });
  it("invalidação cancela todas as reservas e libera alteração dos participantes", async () => {
    const id = await setup(); await execute(id);
    for (const actor of [A, B, C]) await ownReservation(actor, id);
    await expect(groups.leave(C, id)).rejects.toMatchObject({ code: "active_draw" });
    await expect(groups.remove(A, id, B)).rejects.toMatchObject({ code: "active_draw" });
    await expect(groups.add(A, id, D)).rejects.toMatchObject({ code: "active_draw" });
    await execute(id, "invalidate");
    expect((await rawGroup(id))!.activeDrawId).toBeNull();
    expect(await db.collection("reservations").countDocuments({ groupId: oid(id), status: "active" })).toBe(0);
    expect(await lists.secretSanta(A, id)).toMatchObject({ state: "pending" });
    await groups.leave(C, id); await groups.add(A, id, D); await groups.remove(A, id, B);
    await expect(lists.list(A, id, D)).rejects.toMatchObject({ code: "not_found" });
  });
  it("formulário antigo não cancela a edição nova", async () => {
    const id = await setup(); await execute(id); const stale = await service.status(A, id);
    await execute(id, "redraw"); const before = await rawGroup(id);
    await expect(service.execute(A, id, "invalidate", stale)).rejects.toMatchObject({ code: "stale" });
    expect((await rawGroup(id))!.activeDrawId).toEqual(before!.activeDrawId);
  });
  it("falha após criar atribuições desfaz novo sorteio e cancelamentos", async () => {
    const id = await setup(); await execute(id); await ownReservation(A, id);
    const before = await rawGroup(id);
    const failing = createSecretSantaService({ transaction: <T>(work: (unit: DrawUnit) => Promise<T>) => repository.transaction((unit) => work({ ...unit, insertAssignments: async (drawId, pairs) => { await unit.insertAssignments(drawId, pairs); throw new Error("private-fixture-after-insert"); } })) });
    await expect(failing.execute(A, id, "redraw", await service.status(A, id))).rejects.toThrow("Não foi possível alterar o sorteio");
    const after = await rawGroup(id);
    expect(after!.activeDrawId).toEqual(before!.activeDrawId); expect(after!.drawRevision).toBe(before!.drawRevision);
    expect(await db.collection("draws").countDocuments({ groupId: oid(id) })).toBe(1);
    expect(await db.collection("reservations").countDocuments({ groupId: oid(id), status: "active" })).toBe(1);
  });
  it.each(["start", "redraw"])("duas operações %s concorrentes publicam uma única edição nova", async (operation) => {
    const id = await setup(); if (operation === "redraw") await execute(id);
    const state = await service.status(A, id);
    const results = await Promise.allSettled([service.execute(A, id, operation, state), service.execute(A, id, operation, state)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.collection("draws").countDocuments({ groupId: oid(id), status: "active" })).toBe(1);
    expect(await db.collection("draws").countDocuments({ groupId: oid(id) })).toBe(operation === "start" ? 1 : 2);
  });
  it.each(["add", "leave", "remove"])("sorteio concorrente com %s preserva a composição correta", async (operation) => {
    const id = await setup(); const state = await service.status(A, id);
    const change = operation === "add" ? groups.add(A, id, D) : operation === "leave" ? groups.leave(C, id) : groups.remove(A, id, C);
    await Promise.allSettled([service.execute(A, id, "start", state), change]);
    const raw = await rawGroup(id);
    if (raw!.activeDrawId) {
      const draw = await db.collection("draws").findOne({ _id: raw!.activeDrawId });
      expect(draw!.membershipVersion).toBe(raw!.membershipVersion);
      expect(await db.collection("assignments").countDocuments({ drawId: draw!._id })).toBe(raw!.memberCount);
    } else expect(await db.collection("draws").countDocuments({ groupId: oid(id), status: "active" })).toBe(0);
  });
  it.each(["redraw", "invalidate"])("reserva concorrente com %s só permanece em edição ativa", async (operation) => {
    const id = await setup(); await execute(id);
    const result = await lists.secretSanta(A, id);
    if (result.state !== "drawn") throw new Error("Fixture");
    const gift = result.wishlist.gifts[0];
    const state = await service.status(A, id);
    const operations = await Promise.allSettled([lists.reserve(A, id, gift.ownerId, gift.id), service.execute(A, id, operation, state)]);
    expect(operations[1].status).toBe("fulfilled");
    const raw = await rawGroup(id);
    const active = await db.collection("reservations").find({ groupId: oid(id), status: "active" }).toArray();
    expect(active.every((row) => raw!.activeDrawId && row.drawId.equals(raw!.activeDrawId))).toBe(true);
    if (operation === "invalidate") expect(active).toHaveLength(0);
  });
  it("transferência preserva sorteio e muda quem pode invalidar", async () => {
    const id = await setup(); await execute(id); const before = await rawGroup(id);
    await groups.transfer(A, id, B);
    expect((await rawGroup(id))!.activeDrawId).toEqual(before!.activeDrawId);
    await expect(service.execute(A, id, "invalidate", await service.status(A, id))).rejects.toMatchObject({ code: "forbidden" });
    await expect(groups.leave(A, id)).rejects.toMatchObject({ code: "active_draw" });
    await service.execute(B, id, "invalidate", await service.status(B, id)); await groups.leave(A, id);
  });
  it("reservar não altera revisão pública nem composição do sorteio", async () => {
    const id = await setup(); await execute(id); const state = await service.status(A, id);
    await ownReservation(A, id);
    expect(await service.status(A, id)).toEqual(state);
    expect(Object.keys(state).sort()).toEqual(["compositionVersion", "hasActiveDraw", "memberCount", "revision"].sort());
  });
  it("índices negam outra edição ativa e atribuição duplicada", async () => {
    const id = await setup(); await execute(id); const raw = await rawGroup(id);
    await expect(db.collection("draws").insertOne({ groupId: oid(id), status: "active" })).rejects.toMatchObject({ code: 11000 });
    const pair = await db.collection("assignments").findOne({ drawId: raw!.activeDrawId });
    await expect(db.collection("assignments").insertOne({ drawId: raw!.activeDrawId, giverId: pair!.giverId, recipientId: oid(D) })).rejects.toMatchObject({ code: 11000 });
  });
});
