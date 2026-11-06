import { candidateQuerySchema, groupCreateSchema, groupIdSchema, groupInfoSchema, groupPageSchema } from "./validation";
import type { Group, GroupRepository, GroupTransaction, GroupView, Member, Page } from "./types";

export class GroupError extends Error {
  constructor(public readonly code: "unauthorized" | "not_found" | "forbidden" | "invalid" | "conflict" | "active_draw" | "transfer_required" | "not_last", message: string) { super(message); }
}
function identity(actor: string | null) {
  const result = groupIdSchema.safeParse(actor);
  if (!result.success) throw new GroupError("unauthorized", "Entre na sua conta para continuar.");
  return result.data;
}
function target(id: unknown) {
  const result = groupIdSchema.safeParse(id);
  if (!result.success) throw new GroupError("not_found", "Grupo ou participante não encontrado.");
  return result.data;
}
function found(group: Group | null): Group {
  if (!group) throw new GroupError("not_found", "Grupo não encontrado.");
  return group;
}
function admin(group: Group, actor: string) {
  if (group.adminId !== actor) throw new GroupError("forbidden", "Somente o administrador pode realizar esta operação.");
}
function compositionAllowed(group: Group) {
  if (group.activeDrawId) throw new GroupError("active_draw", "O sorteio está ativo. O administrador precisa invalidá-lo antes de alterar os participantes.");
}
function view(group: Group): GroupView {
  return {
    id: group.id, name: group.name, description: group.description, type: group.type,
    adminId: group.adminId, memberCount: group.memberCount, hasActiveDraw: Boolean(group.activeDrawId),
    createdAt: group.createdAt.toISOString(), updatedAt: group.updatedAt.toISOString(),
  };
}

function publicMembers(result: Page<Member>): Page<Member> {
  // A projeção também existe no contrato do serviço: mudanças futuras no
  // repositório não podem transformar um perfil mínimo em documento de auth.
  return { items: result.items.map(({ id, name }) => ({ id, name })), nextCursor: result.nextCursor };
}

export function createGroupService(repository: GroupRepository) {
  async function readable(actor: string, id: string) {
    return found(await repository.getForMember(actor, id));
  }
  async function locked(unit: GroupTransaction, actor: string, id: string, adminOnly = true) {
    const group = found(await unit.lock(id));
    // Esta verificação é refeita dentro da transação, depois de disputar a escrita
    // no grupo. Uma transferência concorrente não deixa o antigo admin com poderes.
    if (!await unit.isMember(id, actor)) throw new GroupError("not_found", "Grupo não encontrado.");
    if (adminOnly) admin(group, actor);
    return group;
  }
  async function remove(unit: GroupTransaction, group: Group, userId: string) {
    if (group.adminId === userId) throw new GroupError("transfer_required", "Transfira a administração antes de sair. Se você for o último membro, encerre o grupo com confirmação.");
    if (!await unit.isMember(group.id, userId)) throw new GroupError("not_found", "Participante não encontrado.");
    await unit.removeMember(group.id, userId);
    await unit.patch(group.id, { memberCount: group.memberCount - 1, membershipVersion: group.membershipVersion + 1, updatedAt: new Date() });
  }
  return {
    async create(actor: string | null, input: unknown) {
      const userId = identity(actor);
      const parsed = groupCreateSchema.safeParse(input);
      if (!parsed.success) throw new GroupError("invalid", "Confira os dados do grupo.");
      return repository.transaction(async (unit) => {
        if (!await unit.userExists(userId)) throw new GroupError("unauthorized", "Entre na sua conta para continuar.");
        const now = new Date();
        const group = await unit.insertGroup({ ...parsed.data, adminId: userId, memberCount: 1, membershipVersion: 1, writeVersion: 1, activeDrawId: null, createdAt: now, updatedAt: now });
        await unit.insertMember(group.id, userId, now);
        return view(group);
      });
    },
    async list(actor: string | null, query: unknown = {}) {
      const userId = identity(actor);
      const parsed = groupPageSchema.safeParse(query);
      if (!parsed.success) throw new GroupError("invalid", "Página de grupos inválida.");
      const result = await repository.listForMember(userId, parsed.data.cursor);
      return { items: result.items.map(view), nextCursor: result.nextCursor };
    },
    async drawnGroups(actor: string | null, query: unknown = {}) {
      const userId = identity(actor), parsed = groupPageSchema.safeParse(query);
      if (!parsed.success) throw new GroupError("invalid", "Página de grupos inválida.");
      const result = await repository.listForMember(userId, parsed.data.cursor, true);
      return { items: result.items.map(view), nextCursor: result.nextCursor };
    },
    async get(actor: string | null, id: unknown, query: unknown = {}) {
      const userId = identity(actor);
      const groupId = target(id);
      const group = await readable(userId, groupId);
      const parsed = groupPageSchema.safeParse(query);
      if (!parsed.success) throw new GroupError("invalid", "Página de participantes inválida.");
      return { group: view(group), members: publicMembers(await repository.listMembers(groupId, parsed.data.cursor)) };
    },
    async search(actor: string | null, id: unknown, query: unknown) {
      const userId = identity(actor);
      const groupId = target(id);
      admin(await readable(userId, groupId), userId);
      const parsed = candidateQuerySchema.safeParse(query);
      if (!parsed.success) throw new GroupError("invalid", "Use até 100 caracteres para pesquisar pelo nome.");
      if (!parsed.data.q) return { items: [], nextCursor: null };
      return publicMembers(await repository.searchCandidates(groupId, parsed.data.q, parsed.data.cursor));
    },
    async update(actor: string | null, id: unknown, input: unknown) {
      const userId = identity(actor), groupId = target(id);
      const parsed = groupInfoSchema.safeParse(input);
      if (!parsed.success) throw new GroupError("invalid", "Confira os dados do grupo.");
      await repository.transaction(async (unit) => {
        await locked(unit, userId, groupId);
        await unit.patch(groupId, { ...parsed.data, updatedAt: new Date() });
      });
    },
    async add(actor: string | null, id: unknown, participant: unknown) {
      const userId = identity(actor), groupId = target(id), participantId = target(participant);
      await repository.transaction(async (unit) => {
        const group = await locked(unit, userId, groupId);
        compositionAllowed(group);
        if (!await unit.userExists(participantId)) throw new GroupError("not_found", "Usuário não encontrado.");
        if (await unit.isMember(groupId, participantId)) throw new GroupError("conflict", "Este usuário já participa do grupo.");
        await unit.insertMember(groupId, participantId, new Date());
        await unit.patch(groupId, { memberCount: group.memberCount + 1, membershipVersion: group.membershipVersion + 1, updatedAt: new Date() });
      });
    },
    async remove(actor: string | null, id: unknown, participant: unknown) {
      const userId = identity(actor), groupId = target(id), participantId = target(participant);
      await repository.transaction(async (unit) => {
        const group = await locked(unit, userId, groupId);
        compositionAllowed(group);
        await remove(unit, group, participantId);
      });
    },
    async leave(actor: string | null, id: unknown) {
      const userId = identity(actor), groupId = target(id);
      await repository.transaction(async (unit) => {
        const group = await locked(unit, userId, groupId, false);
        compositionAllowed(group);
        await remove(unit, group, userId);
      });
    },
    async transfer(actor: string | null, id: unknown, participant: unknown) {
      const userId = identity(actor), groupId = target(id), participantId = target(participant);
      await repository.transaction(async (unit) => {
        await locked(unit, userId, groupId);
        if (!await unit.isMember(groupId, participantId) || !await unit.userExists(participantId)) throw new GroupError("not_found", "Escolha um participante atual do grupo.");
        if (participantId === userId) throw new GroupError("conflict", "Você já administra este grupo.");
        // Transferir não altera composição nem invalida a edição ativa do sorteio.
        await unit.patch(groupId, { adminId: participantId, updatedAt: new Date() });
      });
    },
    async close(actor: string | null, id: unknown) {
      const userId = identity(actor), groupId = target(id);
      await repository.transaction(async (unit) => {
        const group = await locked(unit, userId, groupId);
        compositionAllowed(group);
        if (group.memberCount !== 1) throw new GroupError("not_last", "O grupo tem outros participantes. Transfira a administração antes de sair.");
        await unit.deleteGroup(groupId);
      });
    },
  };
}
