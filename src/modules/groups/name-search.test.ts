import { describe, expect, it } from "vitest";
import { buildNameSearch } from "./name-search";

function matches(query: string, name: string, exact = false) {
  const patterns = buildNameSearch(query);
  return Boolean(patterns && (exact ? patterns.exact : patterns.tolerant).every((pattern) => new RegExp(pattern, "iu").test(name)));
}
describe("pesquisa de nomes", () => {
  it("encontra partes do nome, acentos e palavras em outra ordem", () => {
    expect(matches("aparecida", "Maria Aparecida dos Santos", true)).toBe(true);
    expect(matches("SANTOS maria", "Maria Aparecida dos Santos", true)).toBe(true);
    expect(matches("jose", "José Luís", true)).toBe(true);
    expect(matches("luís", "Jose Luis", true)).toBe(true);
    expect(matches("parec", "Maria Aparecida", true)).toBe(true);
  });
  it.each(["mria", "mariaa", "maroa", "maira"])("tolera um erro em %s", (query) => {
    expect(matches(query, "Maria Aparecida")).toBe(true);
    expect(matches(query, "Maria Aparecida", true)).toBe(false);
  });
  it("combina parte e erro de digitação sem aceitar nomes distantes", () => {
    expect(matches("santos mria", "Maria dos Santos")).toBe(true);
    expect(matches("aparc", "Maria Aparecida")).toBe(true);
    expect(matches("mrxx", "Maria Aparecida")).toBe(false);
    expect(matches("ana", "Carlos")).toBe(false);
  });
  it("não executa regex enviada e não abre pesquisa vazia ou de uma letra", () => {
    expect(matches(".*", "Qualquer pessoa")).toBe(false);
    expect(matches(".*", "Regex.*Pessoa", true)).toBe(true);
    expect(matches("(a+)+", "aaaa")).toBe(false);
    expect(buildNameSearch(" ")).toBeNull();
    expect(buildNameSearch("á")).toBeNull();
    expect(matches("a".repeat(100), "b".repeat(100))).toBe(false);
  });
});
