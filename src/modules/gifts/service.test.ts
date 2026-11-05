import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftService } from "./service";
import type { GiftRepository, Gift } from "./types";

const owner = "000000000000000000000001";
const id = "000000000000000000000002";
const input = { name: "Livro", description: "Receitas para celebrar", productUrl: "https://example.test/book", imageUrl: "https://example.test/book.png" };
const gift: Gift = { ...input, id, ownerId: owner, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") };
const repository = {
  insert: vi.fn(), findOwned: vi.fn(), listOwned: vi.fn(), updateOwned: vi.fn(), deleteOwned: vi.fn(),
} satisfies GiftRepository;
const service = createGiftService(repository);
beforeEach(() => {
  vi.resetAllMocks();
  repository.insert.mockResolvedValue(gift);
  repository.findOwned.mockResolvedValue(gift);
  repository.updateOwned.mockResolvedValue(gift);
  repository.deleteOwned.mockResolvedValue(true);
  repository.listOwned.mockResolvedValue({ gifts: [gift], nextCursor: null });
});

describe("lista pessoal de presentes", () => {
  it("cria com identidade autenticada e datas do servidor", async () => {
    const result = await service.create(owner, { ...input, ownerId: "attacker" });
    expect(repository.insert).toHaveBeenCalledWith(expect.objectContaining({ ...input, ownerId: owner, createdAt: expect.any(Date), updatedAt: expect.any(Date) }));
    expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
  it("não grava entrada inválida", async () => {
    await expect(service.create(owner, { ...input, productUrl: "javascript:alert(1)" })).rejects.toMatchObject({ code: "invalid" });
    expect(repository.insert).not.toHaveBeenCalled();
  });
  it("atualiza filtrando simultaneamente ID e proprietário, sem alterar criação/dono", async () => {
    await service.update(owner, id, { ...input, name: "Livro novo", ownerId: "other", createdAt: "yesterday" });
    expect(repository.updateOwned).toHaveBeenCalledWith(owner, id, { ...input, name: "Livro novo", updatedAt: expect.any(Date) });
  });
  it("não distingue presente alheio de ID inexistente", async () => {
    repository.findOwned.mockResolvedValue(null);
    repository.updateOwned.mockResolvedValue(null);
    repository.deleteOwned.mockResolvedValue(false);
    await expect(service.get(owner, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.update(owner, id, input)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.remove(owner, id)).rejects.toMatchObject({ code: "not_found" });
  });
  it("exclui somente com filtro do proprietário autenticado", async () => {
    await service.remove(owner, id);
    expect(repository.deleteOwned).toHaveBeenCalledWith(owner, id);
  });
  it("listagem ignora dono enviado na consulta e não expõe reservas/campos extras", async () => {
    repository.listOwned.mockResolvedValue({ gifts: [{ ...gift, reservedBy: "hidden", status: "reserved" }], nextCursor: id });
    const page = await service.list(owner, { ownerId: "someone-else" });
    expect(repository.listOwned).toHaveBeenCalledWith(owner, undefined);
    expect(Object.keys(page.gifts[0]).sort()).toEqual(["id", "ownerId", "name", "description", "productUrl", "imageUrl", "createdAt", "updatedAt"].sort());
    expect(page.nextCursor).toBe(id);
  });
  it("valida cursor antes da consulta", async () => {
    await expect(service.list(owner, { cursor: "invalid" })).rejects.toMatchObject({ code: "invalid" });
    expect(repository.listOwned).not.toHaveBeenCalled();
  });
  it.each([null, "", "invalid"])("todas as operações negam identidade ausente/inválida", async (actor) => {
    await expect(service.create(actor, input)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(service.list(actor)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(service.get(actor, id)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(service.update(actor, id, input)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(service.remove(actor, id)).rejects.toMatchObject({ code: "unauthorized" });
    expect(repository.insert).not.toHaveBeenCalled();
  });
});
