const accents: Record<string, string> = {
  a: "[aáàâãäå]", e: "[eéèêë]", i: "[iíìîï]", o: "[oóòôõö]", u: "[uúùûü]", c: "[cç]", n: "[nñ]", y: "[yýÿ]",
};
const letter = "[\\p{L}\\p{N}]";
function atom(character: string) {
  const escaped = accents[character] ?? character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return /\p{L}/u.test(character) ? `${escaped}\\p{M}*` : escaped;
}

/**
 * Monta padrões literais por palavra: qualquer parte do nome serve, em qualquer
 * ordem, sem diferenciar caixa ou acentos portugueses. Não interpreta regex do usuário.
 * Para palavras de 4–32 letras, acrescenta até uma inserção, omissão, troca ou
 * inversão adjacente. A aproximação começa numa palavra e admite nome incompleto;
 * termos curtos permanecem literais para não produzir sugestões quase aleatórias.
 * A expansão cresce quadraticamente. Acima de 32 letras ou 8 mil caracteres de
 * padrão, mantém só a parte literal, evitando o limite de compilação do MongoDB.
 * O repositório também limita o tempo da consulta.
 * Não exige campos novos, migração do banco real ou serviço externo de pesquisa.
 */
export function buildNameSearch(query: string): { exact: string[]; tolerant: string[] } | null {
  const normalized = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  if (normalized.length < 2) return null;
  const terms = [...new Set(normalized.split(/\s+/u))];
  const exact = terms.map((term) => [...term].map(atom).join(""));
  const tolerant = terms.map((term, index) => {
    const characters = [...term];
    if (characters.length < 4 || characters.length > 32 || !/^\p{L}+$/u.test(term)) return exact[index];
    const atoms = characters.map(atom), variants = new Set<string>();
    for (let position = 0; position < atoms.length; position++) {
      const before = atoms.slice(0, position).join(""), after = atoms.slice(position + 1).join("");
      variants.add(before + after); // Uma letra digitada a mais.
      variants.add(before + letter + after); // Uma letra diferente.
      variants.add(before + letter + atoms.slice(position).join("")); // Uma letra omitida.
      if (position + 1 < atoms.length) variants.add(before + atoms[position + 1] + atoms[position] + atoms.slice(position + 2).join(""));
    }
    variants.add(atoms.join("") + letter);
    // O limite é de palavra apenas na aproximação. A parte literal continua
    // encontrando, por exemplo, “parec” no meio de “Aparecida”. Não há .* livre.
    const pattern = `(?:${exact[index]}|(?:^|[^\\p{L}\\p{N}\\p{M}])(?:${[...variants].join("|")}))`;
    return pattern.length <= 8000 ? pattern : exact[index];
  });
  return { exact, tolerant };
}
