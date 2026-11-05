"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "../auth/session";
import { getGiftService } from "./server";
import { GiftError } from "./service";
import { giftIdSchema, giftInputSchema } from "./validation";
import type { GiftActionState } from "./types";

type Operation = "create" | "update" | "remove";

async function mutate(operation: Operation, id: string | null, form: FormData): Promise<GiftActionState> {
  const fallback = operation === "remove"
    ? "Não foi possível excluir o presente agora. Tente novamente."
    : "Não foi possível salvar o presente agora. Tente novamente.";
  try {
    // Toda chamada é autenticada novamente. Renderizar o formulário em uma página
    // privada não torna a Server Action privada por si só, e o ID bound é entrada.
    const user = await getCurrentUser();
    if (!user) return { message: "Entre na sua conta para continuar." };
    if (operation !== "create" && !giftIdSchema.safeParse(id).success) {
      return { message: "Presente não encontrado." };
    }
    if (operation === "remove") {
      if (form.get("confirm") !== "excluir") return { message: "Confirme a exclusão do presente." };
      await (await getGiftService()).remove(user.id, id);
    } else {
      // Extração por lista permitida: ownerId, datas e campos de reservas nunca
      // são aceitos do formulário. A validação antecede abrir a persistência.
      const input = giftInputSchema.safeParse({
        name: form.get("name"), description: form.get("description"),
        productUrl: form.get("productUrl"), imageUrl: form.get("imageUrl"),
      });
      if (!input.success) {
        return { message: "Confira os campos destacados.", fields: z.flattenError(input.error).fieldErrors };
      }
      const service = await getGiftService();
      if (operation === "create") await service.create(user.id, input.data);
      else await service.update(user.id, id, input.data);
    }
  } catch (error) {
    return { message: error instanceof GiftError ? error.message : fallback };
  }
  // redirect lança uma exceção de controle do Next. Manter fora do catch evita
  // transformar uma gravação bem-sucedida em erro e incentivar envio duplicado.
  revalidatePath("/presentes");
  if (id) revalidatePath(`/presentes/${id}/editar`);
  const status = operation === "create" ? "criado" : operation === "update" ? "atualizado" : "excluido";
  redirect(`/presentes?status=${status}`);
}

export async function createGiftAction(_previous: GiftActionState, form: FormData) {
  return mutate("create", null, form);
}
export async function updateGiftAction(id: string, _previous: GiftActionState, form: FormData) {
  return mutate("update", id, form);
}
export async function deleteGiftAction(id: string, _previous: GiftActionState, form: FormData) {
  return mutate("remove", id, form);
}
