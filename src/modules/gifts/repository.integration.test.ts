import { MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMongoGiftRepository, ensureGiftIndexes } from "./repository";
import { createGiftService } from "./service";

vi.mock("server-only", () => ({}));
const uri = process.env.INTEGRATION_DATABASE_URL ?? "";
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/lista_natalina_test\?directConnection=true$/.test(uri)) {
  throw new Error("Use pnpm test:integration com o MongoDB descartável.");
}
const client = new MongoClient(uri);
// Cada suite usa seu próprio banco: o teardown de auth não interfere em gifts.
const db = client.db("lista_natalina_test_gifts");
const service = createGiftService(createMongoGiftRepository(db, client));
const owner = new ObjectId().toHexString();
const other = new ObjectId().toHexString();
const input = { name: "Livro", description: "Receitas em família", productUrl: "https://example.test/book", imageUrl: "https://example.test/book.png" };
let id: string;
beforeAll(async () => { await client.connect(); await ensureGiftIndexes(db); });
afterAll(async () => { await db.dropDatabase(); await client.close(); });

describe("persistência e autorização dos presentes", () => {
  it("persiste proprietário/datas sem aceitar metadados forjados", async () => {
    const gift = await service.create(owner, { ...input, ownerId: other });
    id = gift.id;
    const document = await db.collection("gifts").findOne({ _id: new ObjectId(id) });
    expect(document?.ownerId).toEqual(new ObjectId(owner));
    expect(document?.createdAt).toBeInstanceOf(Date);
    expect(document?.updatedAt).toBeInstanceOf(Date);
  });
  it("nega consulta, edição e exclusão por terceiro; não altera o documento", async () => {
    await expect(service.get(other, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.update(other, id, { ...input, name: "Stolen" })).rejects.toMatchObject({ code: "not_found" });
    await expect(service.remove(other, id)).rejects.toMatchObject({ code: "not_found" });
    expect((await service.get(owner, id)).name).toBe(input.name);
    expect((await service.list(other)).gifts).toEqual([]);
  });
  it("rejeita cadastro inválido sem gravar", async () => {
    await expect(service.create(owner, { ...input, imageUrl: "data:text/html,unsafe" })).rejects.toMatchObject({ code: "invalid" });
    expect(await db.collection("gifts").countDocuments()).toBe(1);
  });
  it("edita somente campos permitidos, mantendo identidade e criação", async () => {
    const before = await service.get(owner, id);
    await service.update(owner, id, { ...input, name: "Livro atualizado", ownerId: other, createdAt: "forged" });
    const after = await service.get(owner, id);
    expect(after.name).toBe("Livro atualizado");
    expect(after.ownerId).toBe(owner);
    expect(after.createdAt).toBe(before.createdAt);
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(before.updatedAt).getTime());
  });
  it("não retorna status/identidade de reservas mesmo com campos extras no documento", async () => {
    await db.collection("gifts").updateOne({ _id: new ObjectId(id) }, { $set: { reservedBy: other, reservationStatus: "active" } });
    const result = await service.get(owner, id);
    expect(result).not.toHaveProperty("reservedBy");
    expect(result).not.toHaveProperty("reservationStatus");
    expect(Object.keys(result)).toHaveLength(8);
  });
  it("exclui e impede leitura/exclusão repetida do item", async () => {
    await service.remove(owner, id);
    await expect(service.get(owner, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.remove(owner, id)).rejects.toMatchObject({ code: "not_found" });
  });
  it("percorre mais de uma página, sem duplicação nem limite total de presentes", async () => {
    const pagedOwner = new ObjectId().toHexString();
    const foreign = await service.create(other, input);
    for (let index = 0; index < 50; index++) await service.create(pagedOwner, { ...input, name: `Livro ${index}` });
    let cursor: string | undefined;
    const ids: string[] = [];
    do {
      const page = await service.list(pagedOwner, { cursor, ownerId: other });
      expect(page.gifts.length).toBeLessThanOrEqual(24);
      ids.push(...page.gifts.map((gift) => gift.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
    expect(ids).not.toContain(foreign.id);
  });
  it("persiste imagem vazia sem vincular dados a uma URL de hospedagem", async () => {
    const gift = await service.create(owner, { ...input, imageUrl: "" });
    expect((await service.get(owner, gift.id)).imageUrl).toBe("");
    const raw = await db.collection("gifts").findOne({ _id: new ObjectId(gift.id) });
    expect(raw?.imageUrl).toBe("");
  });
  it("excluir presente cancela reservas em todos os grupos na mesma operação", async () => {
    const gift = await service.create(owner, input);
    const groupIds = [new ObjectId(), new ObjectId()];
    await db.collection("reservations").insertMany(groupIds.map((groupId) => ({ groupId, giftId: new ObjectId(gift.id), ownerId: new ObjectId(owner), reservedBy: new ObjectId(other), status: "active" })));
    await service.remove(owner, gift.id);
    const reservations = await db.collection("reservations").find({ giftId: new ObjectId(gift.id) }).toArray();
    expect(reservations).toHaveLength(2);
    expect(reservations.every((row) => row.status === "cancelled" && row.cancelledAt instanceof Date)).toBe(true);
  });
  it("usa índice compatível com filtro de dono e paginação", async () => {
    const indexes = await db.collection("gifts").indexes();
    expect(indexes.some((index) => index.key.ownerId === 1 && index.key._id === -1)).toBe(true);
  });
});
