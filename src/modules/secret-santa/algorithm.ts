import "server-only";
import { randomInt } from "node:crypto";
import { MIN_PARTICIPANTS } from "./validation";
import type { Assignment } from "./types";

/** Embaralha por Fisher–Yates e rejeita qualquer autoatribuição. O índice aleatório
 * vem de crypto.randomInt, com limite superior exclusivo. Cada permutação do
 * embaralhamento tem a mesma chance; rejeitar as inválidas não favorece uma das
 * válidas. Não usamos Sattolo, que restringiria o resultado a um único ciclo.
 * A entrada é copiada e o limite de tentativas impede laço infinito no servidor. */
export function generateAssignments(members: string[], randomIndex: (upper: number) => number = randomInt): Assignment[] {
  if (members.length < MIN_PARTICIPANTS || new Set(members).size !== members.length) throw new Error("Use pelo menos três participantes diferentes.");
  for (let attempt = 0; attempt < 128; attempt++) {
    const recipients = [...members];
    for (let index = recipients.length - 1; index > 0; index--) {
      const target = randomIndex(index + 1);
      if (!Number.isInteger(target) || target < 0 || target > index) throw new Error("Fonte de aleatoriedade inválida.");
      [recipients[index], recipients[target]] = [recipients[target], recipients[index]];
    }
    if (recipients.every((id, index) => id !== members[index])) return members.map((id, index) => ({ giverId: id, recipientId: recipients[index] }));
  }
  throw new Error("Não foi possível gerar o sorteio agora. Tente novamente.");
}
