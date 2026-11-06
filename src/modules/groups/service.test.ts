import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGroupService } from "./service";
import type { GroupRepository, GroupTransaction } from "./types";

const admin = "000000000000000000000001";
const member = "000000000000000000000002";
const stranger = "000000000000000000000003";
const id = "000000000000000000000004";
const group = { id, adminId: admin, name: "Família", description: "Natal juntos", type: "conventional" as const, memberCount: 2, membershipVersion: 2, writeVersion: 1, createdAt: new Date(), updatedAt: new Date(), activeDrawId: null as string | null };
const reads = { getForMember: vi.fn(), listForMember: vi.fn(), listMembers: vi.fn(), searchCandidates: vi.fn() };
const tx = { ...reads, lock: vi.fn(), userExists: vi.fn(), isMember: vi.fn(), insertGroup: vi.fn(), insertMember: vi.fn(), patch: vi.fn(), removeMember: vi.fn(), deleteGroup: vi.fn() } satisfies GroupTransaction;
const repository: GroupRepository = { ...reads, transaction: async <T>(work: (unit: GroupTransaction) => Promise<T>) => work(tx) };
const service = createGroupService(repository);
beforeEach(() => {
  vi.resetAllMocks();
  tx.lock.mockResolvedValue({ ...group });
  tx.userExists.mockResolvedValue(true);
  tx.isMember.mockImplementation(async (_group, user) => user === admin || user === member);
  tx.insertGroup.mockImplementation(async (input) => ({ ...input, id }));
  reads.getForMember.mockResolvedValue({ ...group, assignments: ["private"] });
  reads.listForMember.mockResolvedValue({ items: [group], nextCursor: null });
  reads.listMembers.mockResolvedValue({ items: [{ id: admin, name: "Ana" }], nextCursor: null });
  reads.searchCandidates.mockResolvedValue({ items: [{ id: stranger, name: "Beatriz" }], nextCursor: null });
});

describe("regras dos grupos", () => {
  it("cria administrador e participação na mesma unidade transacional", async () => {
    await service.create(admin, { name: " Família ", type: "conventional", adminId: stranger });
    expect(tx.insertGroup).toHaveBeenCalledWith(expect.objectContaining({ name: "Família", adminId: admin, memberCount: 1, membershipVersion: 1 }));
    expect(tx.insertMember).toHaveBeenCalledWith(id, admin, expect.any(Date));
  });
  it("não grava grupo inválido", async () => {
    await expect(service.create(admin, { name: "", type: "invalid" })).rejects.toMatchObject({ code: "invalid" });
    expect(tx.insertGroup).not.toHaveBeenCalled();
  });
  it("adiciona usuário existente diretamente e incrementa composição", async () => {
    await service.add(admin, id, stranger);
    expect(tx.insertMember).toHaveBeenCalledWith(id, stranger, expect.any(Date));
    expect(tx.patch).toHaveBeenCalledWith(id, expect.objectContaining({ memberCount: 3, membershipVersion: 3 }));
  });
  it("rejeita inclusão duplicada", async () => {
    await expect(service.add(admin, id, member)).rejects.toMatchObject({ code: "conflict" });
    expect(tx.insertMember).not.toHaveBeenCalled();
  });
  it("rejeita usuário inexistente", async () => {
    tx.userExists.mockResolvedValue(false);
    await expect(service.add(admin, id, stranger)).rejects.toMatchObject({ code: "not_found" });
  });
  it.each(["add", "remove", "update", "transfer", "close"])("somente admin pode executar %s", async (operation) => {
    const promise = operation === "add" ? service.add(member, id, stranger)
      : operation === "remove" ? service.remove(member, id, admin)
      : operation === "update" ? service.update(member, id, { name: "Novo" })
      : operation === "transfer" ? service.transfer(member, id, member) : service.close(member, id);
    await expect(promise).rejects.toMatchObject({ code: "forbidden" });
  });
  it("membro sai e admin pode remover outro membro", async () => {
    await service.leave(member, id);
    expect(tx.removeMember).toHaveBeenCalledWith(id, member);
    await service.remove(admin, id, member);
    expect(tx.patch).toHaveBeenCalledWith(id, expect.objectContaining({ memberCount: 1, membershipVersion: 3 }));
  });
  it("admin não pode sair ou se remover sem transferir", async () => {
    await expect(service.leave(admin, id)).rejects.toMatchObject({ code: "transfer_required" });
    await expect(service.remove(admin, id, admin)).rejects.toMatchObject({ code: "transfer_required" });
  });
  it("transfere somente para membro atual e não altera composição/sorteio", async () => {
    await expect(service.transfer(admin, id, stranger)).rejects.toMatchObject({ code: "not_found" });
    await service.transfer(admin, id, member);
    expect(tx.patch).toHaveBeenCalledWith(id, { adminId: member, updatedAt: expect.any(Date) });
  });
  it("edita nome/descrição sem aceitar tipo ou privilégios forjados", async () => {
    await service.update(admin, id, { name: " Novo ", description: "", type: "secret_santa", adminId: member });
    expect(tx.patch).toHaveBeenCalledWith(id, { name: "Novo", description: "", updatedAt: expect.any(Date) });
  });
  it("não permite encerrar com outros participantes", async () => {
    await expect(service.close(admin, id)).rejects.toMatchObject({ code: "not_last" });
  });
  it("último admin encerra o grupo", async () => {
    tx.lock.mockResolvedValue({ ...group, memberCount: 1 });
    await service.close(admin, id);
    expect(tx.deleteGroup).toHaveBeenCalledWith(id);
  });
  it.each(["add", "remove", "leave", "close"])("sorteio ativo bloqueia %s", async (operation) => {
    tx.lock.mockResolvedValue({ ...group, type: "secret_santa", activeDrawId: id });
    const promise = operation === "add" ? service.add(admin, id, stranger)
      : operation === "remove" ? service.remove(admin, id, member)
      : operation === "leave" ? service.leave(member, id) : service.close(admin, id);
    await expect(promise).rejects.toMatchObject({ code: "active_draw" });
  });
  it("sorteio ativo permite transferir administração", async () => {
    tx.lock.mockResolvedValue({ ...group, type: "secret_santa", activeDrawId: id });
    await service.transfer(admin, id, member);
    expect(tx.patch).toHaveBeenCalledWith(id, { adminId: member, updatedAt: expect.any(Date) });
  });
  it("lista amigos secretos ativos com filtro no repositório", async () => {
    await service.drawnGroups(admin);
    expect(reads.listForMember).toHaveBeenCalledWith(admin, undefined, true);
  });
  it("não membro recebe not_found ao tentar mutações", async () => {
    await expect(service.add(stranger, id, member)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.leave(stranger, id)).rejects.toMatchObject({ code: "not_found" });
  });
  it("oculta sorteios/versões e autoriza a pesquisa somente para admin", async () => {
    reads.listMembers.mockResolvedValue({ items: [{ id: member, name: "Bruna", email: "private@example.test" }], nextCursor: null });
    reads.searchCandidates.mockResolvedValue({ items: [{ id: stranger, name: "Beatriz", password: "private" }], nextCursor: null });
    const result = await service.get(admin, id);
    expect(result.members.items).toEqual([{ id: member, name: "Bruna" }]);
    expect(result.group).not.toHaveProperty("assignments");
    expect(result.group).not.toHaveProperty("activeDrawId");
    expect(result.group).not.toHaveProperty("writeVersion");
    await expect(service.search(member, id, { q: "Be" })).rejects.toMatchObject({ code: "forbidden" });
    expect((await service.search(admin, id, { q: " Be " })).items).toEqual([{ id: stranger, name: "Beatriz" }]);
  });
  it("nega leitura e pesquisa sem participação", async () => {
    reads.getForMember.mockResolvedValue(null);
    await expect(service.get(stranger, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.search(stranger, id, { q: "Ana" })).rejects.toMatchObject({ code: "not_found" });
  });
  it("busca vazia não consulta diretório e cursores inválidos são rejeitados", async () => {
    expect((await service.search(admin, id, { q: " " })).items).toEqual([]);
    expect(reads.searchCandidates).not.toHaveBeenCalled();
    await expect(service.list(admin, { cursor: "invalid" })).rejects.toMatchObject({ code: "invalid" });
  });
  it.each([null, "", "invalid"])("nega usuário não autenticado", async (actor) => {
    await expect(service.create(actor, { name: "Grupo", type: "conventional" })).rejects.toMatchObject({ code: "unauthorized" });
    await expect(service.list(actor)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(service.get(actor, id)).rejects.toMatchObject({ code: "unauthorized" });
    expect(tx.lock).not.toHaveBeenCalled();
  });
});
