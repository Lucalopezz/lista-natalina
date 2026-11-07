import { beforeEach, expect, it, vi } from "vitest";
import { createCandidateSearchHandler } from "./search-http";
import { GroupError } from "./service";

const actor = "000000000000000000000001", group = "000000000000000000000002";
const getUser = vi.fn(), search = vi.fn(), getService = vi.fn();
const handle = createCandidateSearchHandler({ getUser, getService });
const request = (query: string) => new Request(`https://example.test/api/grupos/${group}/pessoas?${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ id: actor });
  getService.mockResolvedValue({ search });
  search.mockResolvedValue({ items: [{ id: actor, name: "Pessoa de teste" }], nextCursor: null });
});
it("nega anônimo sem inicializar o repositório e proíbe cache", async () => {
  getUser.mockResolvedValue(null);
  const response = await handle(request("q=Maria"), group);
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(getService).not.toHaveBeenCalled();
});
it("usa identidade da sessão, valida consulta e preserva cursor de relevância", async () => {
  const cursor = `1:${actor}`;
  const response = await handle(request(`q=Maria&cursor=${cursor}&userId=forged`), group);
  expect(response.status).toBe(200);
  expect(search).toHaveBeenCalledWith(actor, group, { q: "Maria", cursor });
  expect(await response.json()).toEqual({ items: [{ id: actor, name: "Pessoa de teste" }], nextCursor: null });
});
it("rejeita consulta longa, parâmetros duplicados, grupo e cursor inválidos", async () => {
  for (const query of [`q=${"a".repeat(101)}`, "q=Ana&q=Maria", "q=Ana&cursor=bad", `cursor=0:${actor}&cursor=1:${actor}`]) {
    expect((await handle(request(query), group)).status).toBe(400);
  }
  expect((await handle(request("q=Ana"), "bad")).status).toBe(404);
  expect(getService).not.toHaveBeenCalled();
});
it.each([["forbidden", 403], ["not_found", 404]] as const)("traduz %s e não expõe erro de infraestrutura", async (code, status) => {
  search.mockRejectedValueOnce(new GroupError(code, "Acesso negado."));
  expect((await handle(request("q=Ana"), group)).status).toBe(status);
  search.mockRejectedValueOnce(new Error("private-database-details"));
  const unavailable = await handle(request("q=Ana"), group);
  expect(unavailable.status).toBe(503);
  expect(await unavailable.text()).not.toContain("private-database-details");
});
