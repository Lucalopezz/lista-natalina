"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../auth/session";
import { getReservationService } from "./server";
import { ReservationError } from "./service";
import { reservationPathSchema } from "./validation";
import type { ReservationActionState } from "./types";

async function mutate(operation: "reserve" | "cancel", groupId: string, ownerId: string, giftId: string, form: FormData): Promise<ReservationActionState> {
  let path = `/grupos/${groupId}/listas/${ownerId}`;
  try {
    // Uma Server Action pode ser chamada diretamente. IDs bound também são
    // entrada não confiável; identidade e edição não vêm do formulário.
    const user = await getCurrentUser();
    if (!user) return { message: "Entre na sua conta para continuar." };
    const parsedPath = reservationPathSchema.safeParse({ groupId, ownerId, giftId });
    if (!parsedPath.success) return { message: "Não foi possível acessar esta lista ou este presente no grupo." };
    if (operation === "cancel" && form.get("confirm") !== "cancelar") return { message: "Confirme o cancelamento da reserva." };
    const service = await getReservationService();
    const result = operation === "reserve" ? await service.reserve(user.id, parsedPath.data.groupId, parsedPath.data.ownerId, parsedPath.data.giftId)
      : await service.cancel(user.id, parsedPath.data.groupId, parsedPath.data.ownerId, parsedPath.data.giftId);
    // O contexto de retorno vem do grupo autorizado no servidor, não de uma URL
    // arbitrária enviada pelo navegador. Amigo secreto permanece no próprio resultado.
    if (result?.groupType === "secret_santa") path = `/grupos/${groupId}/amigo-secreto`;
  } catch (error) {
    return { message: error instanceof ReservationError ? error.message : "Não foi possível alterar a reserva agora. Tente novamente." };
  }
  revalidatePath(path);
  // Fora do catch: o redirecionamento é controle de fluxo do framework.
  redirect(`${path}?status=${operation === "reserve" ? "reservado" : "cancelado"}`);
}
export async function reserveGiftAction(groupId: string, ownerId: string, giftId: string, _previous: ReservationActionState, form: FormData) {
  return mutate("reserve", groupId, ownerId, giftId, form);
}
export async function cancelReservationAction(groupId: string, ownerId: string, giftId: string, _previous: ReservationActionState, form: FormData) {
  return mutate("cancel", groupId, ownerId, giftId, form);
}
