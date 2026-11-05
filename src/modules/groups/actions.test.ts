import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGroupAction, updateGroupAction, addMemberAction, removeMemberAction, transferAdminAction, leaveGroupAction, closeGroupAction } from "./actions";
import { GroupError } from "./service";

const mocks = vi.hoisted(() => ({ user: vi.fn(), service: vi.fn(), create: vi.fn(), update: vi.fn(), add: vi.fn(), remove: vi.fn(), transfer: vi.fn(), leave: vi.fn(), close: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("./server", () => ({ getGroupService: mocks.service }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
const actor = "000000000000000000000001", id = "000000000000000000000002", member = "000000000000000000000003";
const empty = { message: "" };
function form() {
  const data = new FormData();
  Object.entries({ name: "Família", description: "Encontros", type: "conventional", adminId: member, confirm: "confirmar" }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  mocks.user.mockResolvedValue({ id: actor });
  mocks.service.mockResolvedValue(mocks);
  mocks.create.mockResolvedValue({ id });
  mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
});
const calls = {
  create: (data: FormData) => createGroupAction(empty, data),
  update: (data: FormData) => updateGroupAction(id, empty, data),
  add: (data: FormData) => addMemberAction(id, member, empty, data),
  remove: (data: FormData) => removeMemberAction(id, member, empty, data),
  transfer: (data: FormData) => transferAdminAction(id, member, empty, data),
  leave: (data: FormData) => leaveGroupAction(id, empty, data),
  close: (data: FormData) => closeGroupAction(id, empty, data),
};
describe("Server Actions de grupos", () => {
  it.each(Object.keys(calls) as (keyof typeof calls)[])("%s exige sessão sem abrir banco anônimo", async (operation) => {
    mocks.user.mockResolvedValue(null);
    expect((await calls[operation](form())).message).toContain("Entre na sua conta");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("dados inválidos retornam campos sem persistência", async () => {
    const data = form(); data.set("name", " ");
    expect((await createGroupAction(empty, data)).fields?.name).toBeDefined();
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("usa ator da sessão e não adminId do formulário", async () => {
    await expect(createGroupAction(empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.create).toHaveBeenCalledWith(actor, { name: "Família", description: "Encontros", type: "conventional" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard");
    expect(mocks.redirect).toHaveBeenCalledWith(`/grupos/${id}?status=criado`);
  });
  it("edição ignora tipo e administração", async () => {
    await expect(updateGroupAction(id, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.update).toHaveBeenCalledWith(actor, id, { name: "Família", description: "Encontros" });
  });
  it.each(["remove", "transfer", "leave", "close"] as const)("%s exige confirmação", async (operation) => {
    const data = form(); data.delete("confirm");
    expect((await calls[operation](data)).message).toContain("Confirme");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("inclusão direta não exige fluxo de convite", async () => {
    const data = form(); data.delete("confirm");
    await expect(addMemberAction(id, member, empty, data)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.add).toHaveBeenCalledWith(actor, id, member);
  });
  it("saída/encerramento redirecionam para grupos", async () => {
    await expect(leaveGroupAction(id, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/grupos?status=saida");
    await expect(closeGroupAction(id, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/grupos?status=encerrado");
  });
  it("permissão negada não revalida nem navega", async () => {
    mocks.add.mockRejectedValueOnce(new GroupError("forbidden", "Somente o administrador pode realizar esta operação."));
    expect((await addMemberAction(id, member, empty, form())).message).toContain("Somente o administrador");
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("não expõe erro privado da infraestrutura", async () => {
    mocks.user.mockRejectedValueOnce(new Error("private-connection-data"));
    expect((await createGroupAction(empty, form())).message).toBe("Não foi possível alterar o grupo agora. Tente novamente.");
  });
});
