import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "./validation";

describe("dados de autenticação", () => {
  it("normaliza nome/email e preserva senha literalmente", () => {
    expect(signUpSchema.parse({ name: "  Ana Silva  ", email: " ANA@EXAMPLE.TEST ", password: " secret " }))
      .toEqual({ name: "Ana Silva", email: "ana@example.test", password: " secret " });
  });
  it.each([6, 128])("aceita senha de %i caracteres", (size) => {
    expect(signUpSchema.safeParse({ name: "Ana", email: "ana@example.test", password: "a".repeat(size) }).success).toBe(true);
  });
  it.each([0, 5, 129])("recusa senha de %i caracteres", (size) => {
    expect(signUpSchema.safeParse({ name: "Ana", email: "ana@example.test", password: "a".repeat(size) }).success).toBe(false);
  });
  it.each(["", "  ", "a".repeat(101)])("recusa nome inválido", (name) => {
    expect(signUpSchema.safeParse({ name, email: "ana@example.test", password: "secret" }).success).toBe(false);
  });
  it("valida email e ignora identidade/privilégios enviados pelo cliente", () => {
    expect(signInSchema.safeParse({ email: "invalid", password: "secret" }).success).toBe(false);
    expect(signUpSchema.parse({ name: "Ana", email: "ana@example.test", password: "secret", userId: "other", role: "admin" })).not.toHaveProperty("role");
  });
});
