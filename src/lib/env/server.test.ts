import { describe, expect, it, vi } from "vitest";
import { readServerEnv } from "./server";

vi.mock("server-only", () => ({}));

describe("ambiente privado", () => {
  it("aceita URI MongoDB e nome opcional sem exigir variáveis de autenticação", () => {
    expect(readServerEnv({ DATABASE_URL: "mongodb://localhost:27017/wishlist" }))
      .toEqual({ DATABASE_URL: "mongodb://localhost:27017/wishlist" });
    expect(readServerEnv({ DATABASE_URL: "mongodb+srv://example.test/app", DATABASE_NAME: "wishlist" }).DATABASE_NAME).toBe("wishlist");
  });

  it.each([undefined, "", "https://example.test", "mongodb://", "mongodb://host/invalid database"])("rejeita URI ausente ou inválida", (DATABASE_URL) => {
    expect(() => readServerEnv({ DATABASE_URL })).toThrow("Configuração do servidor inválida: DATABASE_URL");
  });

  it("não inclui credenciais na mensagem de erro", () => {
    const secret = "https://user:secret@example.test";
    try {
      readServerEnv({ DATABASE_URL: secret });
      expect.fail("Deveria rejeitar a configuração");
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(String(error)).not.toContain("user:secret");
    }
  });

  it("rejeita nome de banco inválido e remove variáveis não utilizadas", () => {
    expect(() => readServerEnv({ DATABASE_URL: "mongodb://localhost/app", DATABASE_NAME: "invalid/name" })).toThrow("DATABASE_NAME");
    expect(readServerEnv({ DATABASE_URL: "mongodb://localhost/app", OTHER_SECRET: "hidden" })).not.toHaveProperty("OTHER_SECRET");
  });
});
