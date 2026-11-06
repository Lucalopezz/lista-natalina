import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthHttpHandler } from "./http";
import type { Auth } from "./config";
vi.mock("server-only", () => ({}));
const origin = "https://lista.example.test", handler = vi.fn();
const auth = { options: { baseURL: origin }, handler } as unknown as Auth;
const route = createAuthHttpHandler(auth);
beforeEach(() => {
  handler.mockReset();
  handler.mockResolvedValue(new Response(JSON.stringify({ success: true }), { headers: { "content-type": "application/json" } }));
});
function logout(body?: string, extra: Record<string, string> = {}) {
  return route(new Request(`${origin}/api/auth/sign-out`, { method: "POST", headers: { origin, "content-type": "application/json", ...extra }, body }));
}
describe("limites do adaptador de autenticação", () => {
  it("logout rejeita corpo excessivo mesmo com Content-Length falso", async () => {
    const response = await logout(JSON.stringify({ ignored: "x".repeat(9000) }), { "content-length": "1" });
    expect(response.status).toBe(400); expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("logout reconstrói somente o contrato permitido", async () => {
    const response = await logout(JSON.stringify({ token: "forged", callbackURL: "https://untrusted.test", userId: "forged" }), { "content-length": "80" });
    expect(response.status).toBe(200);
    const forwarded = handler.mock.calls[0][0] as Request;
    expect(await forwarded.json()).toEqual({});
    expect(forwarded.headers.get("content-length")).toBeNull();
  });
  it("logout aceita POST vazio sem impor um campo novo ao cliente", async () => {
    expect((await logout()).status).toBe(200);
    const forwarded = handler.mock.calls[0][0] as Request;
    expect(await forwarded.json()).toEqual({});
  });
  it("JSON malformado e origem diferente não chegam à biblioteca", async () => {
    expect((await logout("{bad")).status).toBe(400);
    expect((await logout("{}", { origin: "https://untrusted.test" })).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
