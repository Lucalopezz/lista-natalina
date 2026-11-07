import { MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMongoGroupRepository, ensureGroupIndexes } from "./repository";
import { createGroupService } from "./service";
import type { GroupTransaction } from "./types";

vi.mock("server-only", () => ({}));
const uri = process.env.INTEGRATION_DATABASE_URL ?? "";
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/lista_natalina_test\?directConnection=true$/.test(uri)) throw new Error("Use o runner MongoDB descartável.");
const client = new MongoClient(uri);
const db = client.db("lista_natalina_test_groups");
const repository = createMongoGroupRepository(db, client);
const service = createGroupService(repository);
const a = new ObjectId(), b = new ObjectId(), c = new ObjectId(), regexUser = new ObjectId();
const A = a.toHexString(), B = b.toHexString(), C = c.toHexString();
const create = (name = "Família", type = "conventional") => service.create(A, { name, type });
beforeAll(async () => {
  await client.connect(); await ensureGroupIndexes(db);
  await db.collection("user").insertMany([
    { _id: a, name: "Ana Administradora", email: "private-a@example.test", password: "not-public" },
    { _id: b, name: "Bruna Participante", email: "private-b@example.test", password: "not-public" },
    { _id: c, name: "Carlos Participante", email: "private-c@example.test", password: "not-public" },
    { _id: regexUser, name: "Regex.*Pessoa", email: "private-regex@example.test" },
  ]);
});
afterAll(async () => { await db.dropDatabase(); await client.close(); });

describe("grupos no MongoDB real", () => {
  it("cria grupo e primeiro membro, com administrador único", async () => {
    const group = await create();
    const membership = await db.collection("memberships").findOne({ groupId: new ObjectId(group.id), userId: a });
    expect(membership).toBeTruthy();
    expect(group.memberCount).toBe(1);
    expect(group.adminId).toBe(A);
    expect((await service.list(A)).items.some((item) => item.id === group.id)).toBe(true);
  });
  it("falha ao criar participação desfaz o grupo inteiro", async () => {
    const before = await db.collection("groups").countDocuments();
    const failing = createGroupService({ ...repository,
      transaction: async <T>(work: (unit: GroupTransaction) => Promise<T>) => repository.transaction((unit) => work({
        ...unit, insertMember: async () => { throw new Error("fixture-private-details"); },
      })),
    });
    await expect(failing.create(A, { name: "Rollback", type: "conventional" })).rejects.toThrow("Não foi possível acessar os grupos");
    expect(await db.collection("groups").countDocuments()).toBe(before);
    expect(await db.collection("groups").countDocuments({ name: "Rollback" })).toBe(0);
  });
  it("inclusão é imediata no dashboard e respostas não contêm email/senha", async () => {
    const group = await create(); await service.add(A, group.id, B);
    expect((await service.list(B)).items.some((item) => item.id === group.id)).toBe(true);
    const detail = await service.get(B, group.id);
    expect(detail.group.memberCount).toBe(2);
    expect(detail.members.items.map((m) => m.id).sort()).toEqual([A, B].sort());
    expect(detail.members.items.every((m) => Object.keys(m).sort().join(",") === "id,name")).toBe(true);
    expect(JSON.stringify(detail)).not.toContain("private-");
  });
  it("pesquisa escapa regex, exclui membros e não retorna dados privados", async () => {
    const group = await create();
    expect((await service.search(A, group.id, { q: ".*" })).items).toEqual([{ id: regexUser.toHexString(), name: "Regex.*Pessoa" }]);
    const result = await service.search(A, group.id, { q: "regex.*" });
    expect(result.items).toEqual([{ id: regexUser.toHexString(), name: "Regex.*Pessoa" }]);
    expect((await service.search(A, group.id, { q: "Ana" })).items).toEqual([]);
    await expect(service.search(B, group.id, { q: "Ana" })).rejects.toMatchObject({ code: "not_found" });
  });
  it("encontra nome do meio, acentos e um erro, com correspondências literais primeiro", async () => {
    const group = await create();
    // A ordem de inserção é inversa à relevância: ordenar apenas por ID faria
    // a aproximação aparecer antes da pessoa cujo nome contém o termo digitado.
    const approximate = { _id: new ObjectId(), name: "João Marila de Ávila" };
    const exact = { _id: new ObjectId(), name: "José Mariela de Ávila" };
    await db.collection("user").insertMany([approximate, exact]);
    expect((await service.search(A, group.id, { q: "avila" })).items.map((m) => m.id)).toEqual([approximate._id, exact._id].map(String));
    expect((await service.search(A, group.id, { q: "mariela" })).items).toEqual([exact, approximate].map((u) => ({ id: String(u._id), name: u.name })));
    expect((await service.search(A, group.id, { q: "avila jsoe" })).items).toEqual([{ id: String(exact._id), name: exact.name }]);
    expect((await service.search(A, group.id, { q: "á" })).items).toEqual([]);
    await service.add(A, group.id, String(exact._id));
    expect((await service.search(A, group.id, { q: "mariela" })).items).toEqual([{ id: String(approximate._id), name: approximate.name }]);
  });
  it("pagina da correspondência literal para aproximada sem perder ou repetir pessoas", async () => {
    const group = await create();
    const approximate = Array.from({ length: 23 }, () => ({ _id: new ObjectId(), name: "Pessoa Mirabela" }));
    const exact = Array.from({ length: 23 }, () => ({ _id: new ObjectId(), name: "Pessoa Marabela" }));
    await db.collection("user").insertMany([...approximate, ...exact]);
    const first = await service.search(A, group.id, { q: "marabela" });
    expect(first.items.map((u) => u.id)).toEqual(exact.slice(0, 20).map((u) => String(u._id)));
    const second = await service.search(A, group.id, { q: "marabela", cursor: first.nextCursor });
    expect(second.items.map((u) => u.id)).toEqual([...exact.slice(20), ...approximate.slice(0, 17)].map((u) => String(u._id)));
    const third = await service.search(A, group.id, { q: "marabela", cursor: second.nextCursor });
    expect(third.items.map((u) => u.id)).toEqual(approximate.slice(17).map((u) => String(u._id)));
    expect(third.nextCursor).toBeNull();
  });
  it("não membro não consulta nem altera grupo; membro comum não administra", async () => {
    const group = await create();
    await expect(service.get(B, group.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.update(B, group.id, { name: "Stolen" })).rejects.toMatchObject({ code: "not_found" });
    await service.add(A, group.id, B);
    await expect(service.add(B, group.id, C)).rejects.toMatchObject({ code: "forbidden" });
    await expect(service.transfer(B, group.id, B)).rejects.toMatchObject({ code: "forbidden" });
  });
  it("edição não troca tipo/admin por campos forjados", async () => {
    const group = await create();
    await service.update(A, group.id, { name: "Novo nome", description: "Detalhes", adminId: B, type: "secret_santa" });
    const result = (await service.get(A, group.id)).group;
    expect(result).toMatchObject({ name: "Novo nome", type: "conventional", adminId: A });
  });
  it("duas inclusões concorrentes deixam uma participação e contador consistente", async () => {
    const group = await create();
    const results = await Promise.allSettled([service.add(A, group.id, B), service.add(A, group.id, B)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await service.get(A, group.id)).group.memberCount).toBe(2);
    expect(await db.collection("memberships").countDocuments({ groupId: new ObjectId(group.id) })).toBe(2);
  });
  it("transferência muda poderes; antigo admin consegue sair somente depois", async () => {
    const group = await create(); await service.add(A, group.id, B);
    await expect(service.leave(A, group.id)).rejects.toMatchObject({ code: "transfer_required" });
    await service.transfer(A, group.id, B);
    await expect(service.add(A, group.id, C)).rejects.toMatchObject({ code: "forbidden" });
    await service.add(B, group.id, C);
    await service.leave(A, group.id);
    await expect(service.get(A, group.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await service.get(B, group.id)).group).toMatchObject({ adminId: B, memberCount: 2 });
  });
  it("remoção e saída retiram acesso e presença no dashboard", async () => {
    const group = await create(); await service.add(A, group.id, B); await service.add(A, group.id, C);
    await service.remove(A, group.id, B); await service.leave(C, group.id);
    await expect(service.get(B, group.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await service.list(C)).items.some((item) => item.id === group.id)).toBe(false);
    expect((await service.get(A, group.id)).group.memberCount).toBe(1);
  });
  it("sorteio ativo bloqueia composição/encerramento, mas preserva transferência", async () => {
    const group = await create("Amigo secreto", "secret_santa"); await service.add(A, group.id, B);
    const draw = new ObjectId();
    await db.collection("groups").updateOne({ _id: new ObjectId(group.id) }, { $set: { activeDrawId: draw, assignments: ["never-public"] } });
    await expect(service.add(A, group.id, C)).rejects.toMatchObject({ code: "active_draw" });
    await expect(service.remove(A, group.id, B)).rejects.toMatchObject({ code: "active_draw" });
    await expect(service.leave(B, group.id)).rejects.toMatchObject({ code: "active_draw" });
    await expect(service.close(A, group.id)).rejects.toMatchObject({ code: "active_draw" });
    const before = await db.collection("groups").findOne({ _id: new ObjectId(group.id) });
    await service.transfer(A, group.id, B);
    const after = await db.collection("groups").findOne({ _id: new ObjectId(group.id) });
    expect(after?.activeDrawId).toEqual(draw);
    expect(after?.membershipVersion).toBe(before?.membershipVersion);
    expect((await service.get(B, group.id)).group).not.toHaveProperty("assignments");
    // Simula a futura invalidação explícita no banco exclusivo desta suite.
    await db.collection("groups").updateOne({ _id: new ObjectId(group.id) }, { $set: { activeDrawId: null } });
    await service.leave(A, group.id);
    expect((await service.get(B, group.id)).group.memberCount).toBe(1);
  });
  it("último membro encerra grupo sem remover usuário ou presentes pessoais", async () => {
    const group = await create();
    const gift = await db.collection("gifts").insertOne({ ownerId: a, name: "Wishlist intacta" });
    await service.close(A, group.id);
    await expect(service.get(A, group.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await db.collection("memberships").countDocuments({ groupId: new ObjectId(group.id) })).toBe(0);
    expect(await db.collection("user").findOne({ _id: a })).toBeTruthy();
    expect(await db.collection("gifts").findOne({ _id: gift.insertedId })).toBeTruthy();
  });
  it("encerramento concorrente com inclusão não deixa grupo sem admin/membros órfãos", async () => {
    const group = await create();
    await Promise.allSettled([service.close(A, group.id), service.add(A, group.id, B)]);
    const raw = await db.collection("groups").findOne({ _id: new ObjectId(group.id) });
    const members = await db.collection("memberships").find({ groupId: new ObjectId(group.id) }).toArray();
    if (!raw) expect(members).toHaveLength(0);
    else { expect(raw.memberCount).toBe(members.length); expect(members.some((m) => m.userId.equals(raw.adminId))).toBe(true); }
  });
  it("transferência concorrente com remoção nunca remove o administrador atual", async () => {
    const group = await create(); await service.add(A, group.id, B);
    await Promise.allSettled([service.transfer(A, group.id, B), service.remove(A, group.id, B)]);
    const raw = await db.collection("groups").findOne({ _id: new ObjectId(group.id) });
    expect(await db.collection("memberships").findOne({ groupId: raw!._id, userId: raw!.adminId })).toBeTruthy();
  });
  it("saída/remoção cancela reservas como dono e reservante apenas no grupo afetado", async () => {
    const group = await create(); await service.add(A, group.id, B);
    const other = await create(); await service.add(A, other.id, B);
    const rows = [
      { groupId: new ObjectId(group.id), giftId: new ObjectId(), ownerId: b, reservedBy: a, status: "active" },
      { groupId: new ObjectId(group.id), giftId: new ObjectId(), ownerId: a, reservedBy: b, status: "active" },
      { groupId: new ObjectId(other.id), giftId: new ObjectId(), ownerId: b, reservedBy: a, status: "active" },
    ];
    const inserted = await db.collection("reservations").insertMany(rows);
    await service.leave(B, group.id);
    expect(await db.collection("reservations").countDocuments({ groupId: new ObjectId(group.id), status: "active" })).toBe(0);
    expect((await db.collection("reservations").findOne({ _id: inserted.insertedIds[2] }))?.status).toBe("active");
    await service.remove(A, other.id, B);
    expect((await db.collection("reservations").findOne({ _id: inserted.insertedIds[2] }))?.status).toBe("cancelled");
  });
  it("leitura iniciada antes da remoção não mistura membros adicionados depois", async () => {
    const group = await create(); await service.add(A, group.id, B);
    let barriers = 0;
    const afterRead = async <T>(read: () => Promise<T>) => {
      const result = await read(); barriers++;
      await service.remove(A, group.id, B); await service.add(A, group.id, C);
      return result;
    };
    // A barreira reproduz a revogação exatamente entre autorização e listagem.
    // Não é um efeito externo do código da aplicação; existe só nesta fixture.
    const racing = createGroupService({ ...repository,
      getForMember: (actor, id) => afterRead(() => repository.getForMember(actor, id)),
      transaction: (work) => repository.transaction((unit) => work({ ...unit, getForMember: (actor, id) => afterRead(() => unit.getForMember(actor, id)) })),
    });
    const result = await racing.get(B, group.id);
    expect(barriers).toBe(1);
    expect(result.members.items.map((member) => member.id).sort()).toEqual([A, B].sort());
    await expect(service.get(B, group.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await service.get(A, group.id)).members.items.some((member) => member.id === C)).toBe(true);
  });
  it("pesquisa não incorpora contas criadas após transferência concorrente", async () => {
    const group = await create(); await service.add(A, group.id, B);
    const name = `Cadastro posterior ${new ObjectId().toHexString()}`;
    let barriers = 0;
    const afterRead = async <T>(read: () => Promise<T>) => {
      const result = await read(); barriers++;
      await service.transfer(A, group.id, B);
      await db.collection("user").insertOne({ name, email: "late-fixture@example.test" });
      return result;
    };
    const racing = createGroupService({ ...repository,
      getForMember: (actor, id) => afterRead(() => repository.getForMember(actor, id)),
      transaction: (work) => repository.transaction((unit) => work({ ...unit, getForMember: (actor, id) => afterRead(() => unit.getForMember(actor, id)) })),
    });
    expect((await racing.search(A, group.id, { q: name })).items).toEqual([]);
    expect(barriers).toBe(1);
    await expect(service.search(A, group.id, { q: name })).rejects.toMatchObject({ code: "forbidden" });
  });
  it("filtra amigos secretos antes de limitar a página de grupos", async () => {
    const secret = await create("Ativo antigo", "secret_santa");
    await db.collection("groups").updateOne({ _id: new ObjectId(secret.id) }, { $set: { activeDrawId: new ObjectId() } });
    for (let i = 0; i < 26; i++) await create(`Convencional recente ${i}`);
    const active = await service.drawnGroups(A);
    expect(active.items.some((item) => item.id === secret.id)).toBe(true);
    expect(active.items.every((item) => item.type === "secret_santa" && item.hasActiveDraw)).toBe(true);
    expect((await service.drawnGroups(C)).items.some((item) => item.id === secret.id)).toBe(false);
  });
  it("pagina membros e grupos sem limite total", async () => {
    const group = await create();
    const users = Array.from({ length: 26 }, (_, index) => ({ _id: new ObjectId(), name: `Convidado ${index}` }));
    await db.collection("user").insertMany(users);
    for (const user of users) await service.add(A, group.id, user._id.toHexString());
    const first = await service.get(A, group.id);
    expect(first.members.items).toHaveLength(24);
    const second = await service.get(A, group.id, { cursor: first.members.nextCursor });
    expect(second.members.items).toHaveLength(3);
    expect(new Set([...first.members.items, ...second.members.items].map((m) => m.id)).size).toBe(27);
    for (let index = 0; index < 26; index++) await create(`Grupo de página ${index}`);
    const groups = await service.list(A);
    expect(groups.items).toHaveLength(24);
    expect(groups.nextCursor).toBeTruthy();
    const nextGroups = await service.list(A, { cursor: groups.nextCursor });
    expect(nextGroups.items.length).toBeGreaterThan(0);
    expect(new Set([...groups.items, ...nextGroups.items].map((g) => g.id)).size).toBe(groups.items.length + nextGroups.items.length);
    const searchGroup = await create("Pesquisa paginada");
    const candidates = await service.search(A, searchGroup.id, { q: "Convidado" });
    expect(candidates.items).toHaveLength(20);
    const more = await service.search(A, searchGroup.id, { q: "Convidado", cursor: candidates.nextCursor });
    expect(more.items).toHaveLength(6);
  });
});
