import { describe, expect, it } from "vitest";
import { giftInputSchema, giftIdSchema } from "./validation";

export const input = {
  name: "Livro de receitas", description: "Uma edição com receitas para reunir a família.",
  productUrl: "https://example.test/livro", imageUrl: "https://example.test/livro.png",
};
describe("validação dos presentes", () => {
  it("normaliza texto e descarta campos de identidade/reservas do cliente", () => {
    const result = giftInputSchema.parse({ ...input, name: " Livro ", ownerId: "other", reservedBy: "other", createdAt: "yesterday" });
    expect(result).toEqual({ ...input, name: "Livro" });
  });
  it.each(["javascript:alert(1)", "data:image/svg+xml,<svg/>", "file:///etc/passwd", "//example.test/a", "ftp://example.test/a", "https://user:pass@example.test/a", "https://example.test/a\nb"])("recusa link inseguro: %s", (url) => {
    expect(giftInputSchema.safeParse({ ...input, productUrl: url }).success).toBe(false);
    expect(giftInputSchema.safeParse({ ...input, imageUrl: url }).success).toBe(false);
  });
  it("aceita imagem ausente ou vazia, mantendo o campo como string vazia", () => {
    const { imageUrl: _image, ...withoutImage } = input;
    void _image;
    expect(giftInputSchema.parse(withoutImage).imageUrl).toBe("");
    expect(giftInputSchema.parse({ ...input, imageUrl: "  " }).imageUrl).toBe("");
  });
  it("aceita HTTP/HTTPS sem buscar o conteúdo da URL", () => {
    expect(giftInputSchema.safeParse({ ...input, productUrl: "http://example.test/a" }).success).toBe(true);
  });
  it.each(["name", "description", "productUrl"])("exige %s", (field) => {
    expect(giftInputSchema.safeParse({ ...input, [field]: "  " }).success).toBe(false);
  });
  it("limita campos por tamanho, sem limitar quantidade de presentes", () => {
    expect(giftInputSchema.safeParse({ ...input, name: "a".repeat(121) }).success).toBe(false);
    expect(giftInputSchema.safeParse({ ...input, description: "a".repeat(2001) }).success).toBe(false);
    expect(giftInputSchema.safeParse({ ...input, productUrl: `https://example.test/${"a".repeat(2048)}` }).success).toBe(false);
  });
  it.each(["invalid", "", "123", "a".repeat(25)])("rejeita ID inválido", (id) => {
    expect(giftIdSchema.safeParse(id).success).toBe(false);
  });
});
