import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, requireCurrentUser } from "./session";

const mocks = vi.hoisted(() => ({ headers: vi.fn(), getAuth: vi.fn(), getSession: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./server", () => ({ getAuth: mocks.getAuth }));
beforeEach(() => {
  mocks.headers.mockResolvedValue(new Headers({ cookie: "better-auth.session_token=example" }));
  mocks.getAuth.mockResolvedValue({ api: { getSession: mocks.getSession } });
  mocks.getSession.mockResolvedValue(null);
});
describe("identidade no servidor", () => {
  it("não acessa configuração/banco quando não há cookie", async () => {
    mocks.headers.mockResolvedValue(new Headers());
    expect(await getCurrentUser()).toBeNull();
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });
  it("nega sessão ausente ou revogada", async () => {
    expect(await getCurrentUser()).toBeNull();
  });
  it("redireciona acesso privado sem identidade válida", async () => {
    await requireCurrentUser();
    expect(mocks.redirect).toHaveBeenCalledWith("/entrar");
  });
  it("sanitiza falhas do banco sem tratar indisponibilidade como usuário anônimo", async () => {
    mocks.getSession.mockRejectedValueOnce(new Error("private-db-connection-details"));
    await expect(getCurrentUser()).rejects.toThrow("Não foi possível carregar sua conta agora.");
  });
  it("projeta somente os campos do perfil próprio, sem sessão/token", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "me", name: "Ana", email: "ana@example.test", password: "hash", internal: true },
      session: { token: "private", expiresAt: new Date(Date.now() + 1000) },
    });
    expect(await getCurrentUser()).toEqual({ id: "me", name: "Ana", email: "ana@example.test" });
  });
});
