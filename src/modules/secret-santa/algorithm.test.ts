import { describe, expect, it, vi } from "vitest";
import { generateAssignments } from "./algorithm";
vi.mock("server-only", () => ({}));

describe("permutação do amigo secreto", () => {
  it.each([3, 4, 5, 10, 31, 100])("preserva as invariantes para %i pessoas", (count) => {
    const members = Array.from({ length: count }, (_, i) => `person-${i}`);
    for (let run = 0; run < 20; run++) {
      const pairs = generateAssignments(members);
      expect(pairs.map((p) => p.giverId)).toEqual(members);
      expect(new Set(pairs.map((p) => p.recipientId))).toEqual(new Set(members));
      expect(pairs.every((p) => p.giverId !== p.recipientId)).toBe(true);
    }
    expect(members[0]).toBe("person-0");
  });
  it.each([[], ["a"], ["a", "b"], ["a", "a", "b"]].map((members) => [members]))("rejeita composição insuficiente ou duplicada", (members) => {
    expect(() => generateAssignments(members)).toThrow("participantes");
  });
  it("descarta permutação com autoatribuição e tenta outra, sem alterar a entrada", () => {
    const rng = vi.fn().mockReturnValueOnce(2).mockReturnValueOnce(1).mockReturnValue(0);
    const members = ["a", "b", "c"];
    expect(generateAssignments(members, rng)).toEqual([{ giverId: "a", recipientId: "b" }, { giverId: "b", recipientId: "c" }, { giverId: "c", recipientId: "a" }]);
    expect(members).toEqual(["a", "b", "c"]);
    expect(rng).toHaveBeenCalledTimes(4);
  });
  it("encerra após tentativas limitadas se a fonte só gerar a identidade", () => {
    const rng = vi.fn((upper: number) => upper - 1);
    expect(() => generateAssignments(["a", "b", "c"], rng)).toThrow("Tente novamente");
    expect(rng).toHaveBeenCalledTimes(256);
  });
});
