import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftAction, updateGiftAction, deleteGiftAction } from "./actions";
import { GiftError } from "./service";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), service: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), revalidate: vi.fn(), redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("./server", () => ({ getGiftService: mocks.service }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
const owner = "000000000000000000000001";
const id = "000000000000000000000002";
const empty = { message: "" };
function form() {
  const data = new FormData();
  Object.entries({ name: "Livro", description: "Receitas", productUrl: "https://example.test/book", imageUrl: "https://example.test/book.png", ownerId: "forged", confirm: "excluir" }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  mocks.user.mockResolvedValue({ id: owner });
  mocks.service.mockResolvedValue({ create: mocks.create, update: mocks.update, remove: mocks.remove });
  mocks.create.mockResolvedValue({ id });
  mocks.update.mockResolvedValue({ id });
  mocks.remove.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
});
describe("Server Actions de presentes", () => {
  it.each(["create", "update", "remove"])("nega %s anônimo antes de abrir persistência", async (operation) => {
    mocks.user.mockResolvedValue(null);
    const result = operation === "create" ? await createGiftAction(empty, form())
      : operation === "update" ? await updateGiftAction(id, empty, form()) : await deleteGiftAction(id, empty, form());
    expect(result.message).toContain("Entre na sua conta");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("retorna erros por campo sem abrir banco para entrada inválida", async () => {
    const data = form(); data.set("productUrl", "javascript:alert(1)");
    const result = await createGiftAction(empty, data);
    expect(result.fields?.productUrl).toBeDefined();
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("usa a sessão, descarta ownerId e redireciona somente após criar", async () => {
    await expect(createGiftAction(empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.create).toHaveBeenCalledWith(owner, { name: "Livro", description: "Receitas", productUrl: "https://example.test/book", imageUrl: "https://example.test/book.png" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/presentes");
    expect(mocks.redirect).toHaveBeenCalledWith("/presentes?status=criado");
  });
  it("não engole o redirecionamento depois de editar", async () => {
    await expect(updateGiftAction(id, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.update).toHaveBeenCalledWith(owner, id, expect.any(Object));
    expect(mocks.redirect).toHaveBeenCalledWith("/presentes?status=atualizado");
  });
  it("exige confirmação explícita antes de excluir", async () => {
    const data = form(); data.delete("confirm");
    expect((await deleteGiftAction(id, empty, data)).message).toContain("Confirme");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("exclusão confirmada revalida e redireciona", async () => {
    await expect(deleteGiftAction(id, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.remove).toHaveBeenCalledWith(owner, id);
    expect(mocks.redirect).toHaveBeenCalledWith("/presentes?status=excluido");
  });
  it("não revalida nem redireciona quando o item não pertence ao usuário", async () => {
    mocks.update.mockRejectedValueOnce(new GiftError("not_found", "Presente não encontrado."));
    expect(await updateGiftAction(id, empty, form())).toEqual({ message: "Presente não encontrado." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("não mostra detalhes de erro de autenticação/banco", async () => {
    mocks.user.mockRejectedValueOnce(new Error("private-credential"));
    const result = await createGiftAction(empty, form());
    expect(result.message).toBe("Não foi possível salvar o presente agora. Tente novamente.");
    expect(JSON.stringify(result)).not.toContain("private-credential");
  });
});
