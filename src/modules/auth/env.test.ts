import { describe, expect, it, vi } from "vitest";
import { readAuthEnv } from "./env";

vi.mock("server-only", () => ({}));
const valid = {
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("configuração privada da autenticação", () => {
  it("aceita segredo forte e origem HTTP local", () => {
    expect(readAuthEnv(valid).BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
  it.each([undefined, "", "short"])("recusa segredo ausente ou curto", (secret) => {
    expect(() => readAuthEnv({ ...valid, BETTER_AUTH_SECRET: secret })).toThrow("BETTER_AUTH_SECRET");
  });
  it.each(["javascript:alert(1)", "https://example.test/path", "https://user:pass@example.test", "http://example.test"])("recusa origem insegura ou ambígua", (url) => {
    expect(() => readAuthEnv({ ...valid, BETTER_AUTH_URL: url })).toThrow("BETTER_AUTH_URL");
  });
  it("não revela valores sensíveis ao rejeitar configuração", () => {
    expect(() => readAuthEnv({ ...valid, BETTER_AUTH_URL: "https://user:secret@example.test" })).toThrow(/^Configuração da autenticação inválida: BETTER_AUTH_URL$/);
  });
});
