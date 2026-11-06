import { beforeEach, describe, expect, it, vi } from "vitest";
import { drawAction } from "./actions";
import { DrawError } from "./service";
const mocks = vi.hoisted(() => ({ user: vi.fn(), service: vi.fn(), execute: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("./server", () => ({ getSecretSantaService: mocks.service }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
const actor = "000000000000000000000001", id = "000000000000000000000002";
const expected = { revision: 0, compositionVersion: 3 }, empty = { message: "" };
function form(operation = "start") { const f = new FormData(); f.set("confirm", operation); f.set("actorId", "forged"); return f; }
beforeEach(() => { mocks.user.mockResolvedValue({ id: actor }); mocks.service.mockResolvedValue(mocks); mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); }); });
describe("actions de sorteio", () => {
  it.each(["start", "redraw", "invalidate"] as const)("%s autentica e exige confirmação específica", async (op) => {
    mocks.user.mockResolvedValueOnce(null);
    expect((await drawAction(id, op, expected, empty, form(op))).message).toContain("Entre na sua conta");
    expect((await drawAction(id, op, expected, empty, form("wrong"))).message).toContain("Confirme");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("valida IDs e expectativas antes de inicializar serviço", async () => {
    expect((await drawAction("bad", "start", expected, empty, form())).message).toContain("Atualize");
    expect((await drawAction(id, "start", { revision: -1, compositionVersion: 3 }, empty, form())).message).toContain("Atualize");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("usa identidade da sessão e só devolve navegação/feedback", async () => {
    await expect(drawAction(id, "start", expected, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.execute).toHaveBeenCalledWith(actor, id, "start", expected);
    expect(mocks.revalidate).toHaveBeenCalledWith(`/grupos/${id}/amigo-secreto`);
    expect(mocks.redirect).toHaveBeenCalledWith(`/grupos/${id}?status=sorteado`);
  });
  it.each([["redraw", "sorteio_refeito"], ["invalidate", "sorteio_cancelado"]] as const)("%s tem feedback próprio", async (op, status) => {
    await expect(drawAction(id, op, expected, empty, form(op))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(`/grupos/${id}?status=${status}`);
  });
  it("erro conhecido não redireciona nem revalida", async () => {
    mocks.execute.mockRejectedValueOnce(new DrawError("stale", "Atualize o grupo."));
    expect((await drawAction(id, "start", expected, empty, form())).message).toBe("Atualize o grupo.");
    expect(mocks.revalidate).not.toHaveBeenCalled(); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("falha privada é sanitizada", async () => {
    mocks.user.mockRejectedValueOnce(new Error("private-uri"));
    expect((await drawAction(id, "start", expected, empty, form())).message).not.toContain("private-");
  });
});
