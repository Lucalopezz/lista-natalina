"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "../auth/session";
import { getGroupService } from "./server";
import { GroupError } from "./service";
import { groupCreateSchema, groupIdSchema, groupInfoSchema } from "./validation";
import type { GroupActionState } from "./types";

type Operation = "create" | "update" | "add" | "remove" | "transfer" | "leave" | "close";
async function mutate(operation: Operation, id: string | null, participant: string | null, form: FormData): Promise<GroupActionState> {
  let groupId = id;
  try {
    const user = await getCurrentUser();
    if (!user) return { message: "Entre na sua conta para continuar." };
    if (operation !== "create" && !groupIdSchema.safeParse(id).success) return { message: "Grupo não encontrado." };
    if (["add", "remove", "transfer"].includes(operation) && !groupIdSchema.safeParse(participant).success) return { message: "Participante não encontrado." };
    if (["remove", "transfer", "leave", "close"].includes(operation) && form.get("confirm") !== "confirmar") {
      return { message: "Confirme a operação para continuar." };
    }
    if (operation === "create" || operation === "update") {
      const raw = { name: form.get("name"), description: form.get("description") };
      const input = operation === "create" ? groupCreateSchema.safeParse({ ...raw, type: form.get("type") }) : groupInfoSchema.safeParse(raw);
      if (!input.success) return { message: "Confira os campos destacados.", fields: z.flattenError(input.error).fieldErrors };
      const service = await getGroupService();
      if (operation === "create") groupId = (await service.create(user.id, input.data)).id;
      else await service.update(user.id, id, input.data);
    } else {
      const service = await getGroupService();
      // Os IDs bound também são dados não confiáveis. A transação relê participação
      // e administrador atual; o papel exibido na tela não é fonte de autorização.
      if (operation === "add") await service.add(user.id, id, participant);
      else if (operation === "remove") await service.remove(user.id, id, participant);
      else if (operation === "transfer") await service.transfer(user.id, id, participant);
      else if (operation === "leave") await service.leave(user.id, id);
      else await service.close(user.id, id);
    }
  } catch (error) {
    return { message: error instanceof GroupError ? error.message : "Não foi possível alterar o grupo agora. Tente novamente." };
  }
  revalidatePath("/dashboard"); revalidatePath("/grupos");
  if (groupId) { revalidatePath(`/grupos/${groupId}`); revalidatePath(`/grupos/${groupId}/editar`); }
  // redirect fica fora do catch: sucesso não deve ser convertido em mensagem de erro.
  if (operation === "leave" || operation === "close") redirect(`/grupos?status=${operation === "leave" ? "saida" : "encerrado"}`);
  const status = { create: "criado", update: "atualizado", add: "participante_adicionado", remove: "participante_removido", transfer: "administracao_transferida" }[operation];
  redirect(`/grupos/${groupId}?status=${status}`);
}
export async function createGroupAction(_previous: GroupActionState, form: FormData) { return mutate("create", null, null, form); }
export async function updateGroupAction(id: string, _previous: GroupActionState, form: FormData) { return mutate("update", id, null, form); }
export async function addMemberAction(id: string, participant: string, _previous: GroupActionState, form: FormData) { return mutate("add", id, participant, form); }
export async function removeMemberAction(id: string, participant: string, _previous: GroupActionState, form: FormData) { return mutate("remove", id, participant, form); }
export async function transferAdminAction(id: string, participant: string, _previous: GroupActionState, form: FormData) { return mutate("transfer", id, participant, form); }
export async function leaveGroupAction(id: string, _previous: GroupActionState, form: FormData) { return mutate("leave", id, null, form); }
export async function closeGroupAction(id: string, _previous: GroupActionState, form: FormData) { return mutate("close", id, null, form); }
