"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../auth/session";
import { getSecretSantaService } from "./server";
import { DrawError } from "./service";
import { drawRequestSchema, type DrawExpectation, type DrawOperation } from "./validation";
import type { DrawActionState } from "./types";

export async function drawAction(groupId: string, operation: DrawOperation, expectation: DrawExpectation, _previous: DrawActionState, form: FormData): Promise<DrawActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { message: "Entre na sua conta para continuar." };
    const parsed = drawRequestSchema.safeParse({ ...expectation, groupId, operation });
    if (!parsed.success) return { message: "Atualize o grupo para confirmar esta operação." };
    if (form.get("confirm") !== parsed.data.operation) return { message: "Confirme a operação para continuar." };
    // A confirmação expressa intenção. O serviço relê admin/composição/revisão
    // no banco; nem a sessão antiga nem os argumentos bound concedem poderes.
    await (await getSecretSantaService()).execute(user.id, parsed.data.groupId, parsed.data.operation, { revision: parsed.data.revision, compositionVersion: parsed.data.compositionVersion });
  } catch (error) {
    return { message: error instanceof DrawError ? error.message : "Não foi possível alterar o sorteio agora. Tente novamente." };
  }
  revalidatePath("/dashboard"); revalidatePath("/grupos"); revalidatePath("/amigos-secretos");
  revalidatePath(`/grupos/${groupId}`); revalidatePath(`/grupos/${groupId}/amigo-secreto`);
  const status = { start: "sorteado", redraw: "sorteio_refeito", invalidate: "sorteio_cancelado" }[operation];
  redirect(`/grupos/${groupId}?status=${status}`);
}
