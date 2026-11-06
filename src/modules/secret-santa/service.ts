import { groupIdSchema } from "../groups/validation";
import { generateAssignments } from "./algorithm";
import { drawRequestSchema, MIN_PARTICIPANTS } from "./validation";
import type { Assignment, DrawRepository, DrawUnit } from "./types";

export class DrawError extends Error {
  constructor(public readonly code: "unauthorized" | "not_found" | "forbidden" | "invalid" | "insufficient" | "state" | "stale" | "inconsistent", message: string) { super(message); }
}
function identity(actor: string | null) {
  const parsed = groupIdSchema.safeParse(actor);
  if (!parsed.success) throw new DrawError("unauthorized", "Entre na sua conta para continuar.");
  return parsed.data;
}

/** Casos de uso sem endpoint de atribuições coletivas. O administrador muda
 * o estado do sorteio, mas não recebe os pares gerados nem o ID privado da edição. */
export function createSecretSantaService(repository: DrawRepository, generate: (members: string[]) => Assignment[] = generateAssignments) {
  async function groupFor(unit: DrawUnit, actor: string, id: string, write: boolean) {
    const group = await (write ? unit.lockGroup(id) : unit.getGroup(id));
    if (!group || !await unit.isMember(id, actor)) throw new DrawError("not_found", "Grupo não encontrado.");
    if (group.type !== "secret_santa") throw new DrawError("invalid", "Este grupo não é de amigo secreto.");
    return group;
  }
  return {
    async status(actor: string | null, id: unknown) {
      const user = identity(actor), parsed = groupIdSchema.safeParse(id);
      if (!parsed.success) throw new DrawError("not_found", "Grupo não encontrado.");
      return repository.transaction(async (unit) => {
        const group = await groupFor(unit, user, parsed.data, false);
        // drawRevision só muda no ciclo do sorteio. writeVersion também muda por
        // reservas e não pode ser entregue ao dono como indicador de atividade.
        return { hasActiveDraw: Boolean(group.activeDrawId), revision: group.drawRevision, compositionVersion: group.membershipVersion, memberCount: group.memberCount };
      });
    },
    async execute(actor: string | null, id: unknown, operation: unknown, expectation: unknown): Promise<void> {
      const user = identity(actor);
      const parsed = drawRequestSchema.safeParse({ ...(typeof expectation === "object" && expectation ? expectation : {}), groupId: id, operation });
      if (!parsed.success) throw new DrawError("invalid", "Não foi possível confirmar esta operação. Atualize o grupo.");
      const request = parsed.data;
      await repository.transaction(async (unit) => {
        const group = await groupFor(unit, user, request.groupId, true);
        if (group.adminId !== user) throw new DrawError("forbidden", "Somente o administrador pode alterar o sorteio.");
        // Duplo clique ou confirmação antiga não pode operar sobre a edição que
        // acabou de ser publicada. Composição também é revalidada após o lock.
        if (group.drawRevision !== request.revision || group.membershipVersion !== request.compositionVersion) throw new DrawError("stale", "O grupo ou o sorteio mudou. Atualize o grupo antes de confirmar novamente.");
        const active = group.activeDrawId;
        if ((request.operation === "start") === Boolean(active)) throw new DrawError("state", active ? "Já existe um sorteio ativo. Use Refazer sorteio." : "Não há sorteio ativo para refazer ou cancelar.");
        let pairs: Assignment[] = [];
        if (request.operation !== "invalidate") {
          const members = await unit.members(group.id);
          if (members.length !== group.memberCount || new Set(members).size !== members.length) throw new DrawError("inconsistent", "Não foi possível confirmar os participantes. Atualize o grupo.");
          if (members.length < MIN_PARTICIPANTS) throw new DrawError("insufficient", "Adicione pelo menos três participantes para realizar o sorteio.");
          pairs = generate(members);
          const allowed = new Set(members);
          if (pairs.length !== members.length || new Set(pairs.map((p) => p.giverId)).size !== members.length || new Set(pairs.map((p) => p.recipientId)).size !== members.length || pairs.some((p) => !allowed.has(p.giverId) || !allowed.has(p.recipientId) || p.giverId === p.recipientId)) throw new DrawError("inconsistent", "Não foi possível gerar um resultado válido. Tente novamente.");
        }
        const now = new Date();
        if (active) {
          if (!await unit.invalidate(group.id, active, now)) throw new DrawError("inconsistent", "Não foi possível confirmar o sorteio atual. Atualize o grupo.");
          await unit.cancelReservations(group.id, active);
        }
        let next: string | null = null;
        if (request.operation !== "invalidate") {
          next = await unit.insertDraw(group.id, group.membershipVersion, user, now);
          await unit.insertAssignments(next, pairs);
        }
        // Atribuições, cancelamento e ponteiro só ficam visíveis juntos no commit.
        // Se o driver repetir o callback, não há efeitos externos para duplicar.
        await unit.publish(group.id, next, now);
      });
    },
  };
}
