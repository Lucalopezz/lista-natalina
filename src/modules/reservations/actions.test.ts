import { beforeEach, describe, expect, it, vi } from "vitest";
import { reserveGiftAction, cancelReservationAction } from "./actions";
import { ReservationError } from "./service";

const mocks = vi.hoisted(() => ({ user: vi.fn(), service: vi.fn(), reserve: vi.fn(), cancel: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("./server", () => ({ getReservationService: mocks.service }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
const actor = "000000000000000000000001", group = "000000000000000000000002", owner = "000000000000000000000003", gift = "000000000000000000000004";
const empty = { message: "" };
function form() { const f = new FormData(); f.set("confirm", "cancelar"); f.set("reservedBy", owner); f.set("drawId", group); return f; }
beforeEach(() => {
  mocks.user.mockResolvedValue({ id: actor }); mocks.service.mockResolvedValue(mocks);
  mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
});
describe("actions de reservas", () => {
  it.each([reserveGiftAction, cancelReservationAction])("exige sessão antes de abrir persistência", async (action) => {
    mocks.user.mockResolvedValue(null);
    expect((await action(group, owner, gift, empty, form())).message).toContain("Entre na sua conta");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("valida IDs bound mesmo que tenham vindo de uma página autenticada", async () => {
    expect((await reserveGiftAction("bad", owner, gift, empty, form())).message).toContain("Não foi possível acessar");
    expect((await reserveGiftAction(group, "bad", gift, empty, form())).message).toContain("Não foi possível acessar");
    expect((await cancelReservationAction(group, owner, "bad", empty, form())).message).toContain("Não foi possível acessar");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("reserva com usuário da sessão e ignora reservante/edição forjados", async () => {
    await expect(reserveGiftAction(group, owner, gift, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.reserve).toHaveBeenCalledWith(actor, group, owner, gift);
    expect(mocks.redirect).toHaveBeenCalledWith(`/grupos/${group}/listas/${owner}?status=reservado`);
    expect(mocks.revalidate).toHaveBeenCalledWith(`/grupos/${group}/listas/${owner}`);
  });
  it("reserva do amigo secreto volta para o próprio resultado", async () => {
    mocks.reserve.mockResolvedValueOnce({ groupType: "secret_santa" });
    await expect(reserveGiftAction(group, owner, gift, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(`/grupos/${group}/amigo-secreto?status=reservado`);
  });
  it("cancelamento exige confirmação antes de persistir", async () => {
    expect((await cancelReservationAction(group, owner, gift, empty, new FormData())).message).toContain("Confirme");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("cancela somente pela identidade da sessão", async () => {
    await expect(cancelReservationAction(group, owner, gift, empty, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.cancel).toHaveBeenCalledWith(actor, group, owner, gift);
    expect(mocks.redirect).toHaveBeenCalledWith(`/grupos/${group}/listas/${owner}?status=cancelado`);
  });
  it("falha de autorização/conflito não revalida nem redireciona", async () => {
    mocks.reserve.mockRejectedValueOnce(new ReservationError("unavailable", "Este presente já está reservado neste grupo. Atualize a lista."));
    expect((await reserveGiftAction(group, owner, gift, empty, form())).message).toContain("já está reservado");
    expect(mocks.redirect).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("não expõe falhas privadas de sessão ou persistência", async () => {
    mocks.user.mockRejectedValueOnce(new Error("private-uri"));
    expect((await reserveGiftAction(group, owner, gift, empty, form())).message).not.toContain("private-");
    mocks.cancel.mockRejectedValueOnce(new Error("private-driver-details"));
    expect((await cancelReservationAction(group, owner, gift, empty, form())).message).not.toContain("private-");
  });
});
