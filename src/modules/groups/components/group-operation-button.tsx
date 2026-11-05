"use client";

import { useActionState, useRef } from "react";
import { addMemberAction, removeMemberAction, transferAdminAction, leaveGroupAction, closeGroupAction } from "../actions";
import type { GroupActionState } from "../types";

type Operation = "add" | "remove" | "transfer" | "leave" | "close";
const labels = { add: "Adicionar", remove: "Remover", transfer: "Transferir administração", leave: "Sair do grupo", close: "Encerrar grupo" };
export function GroupOperationButton({ operation, groupId, participantId = "", participantName = "" }: { operation: Operation; groupId: string; participantId?: string; participantName?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const action = operation === "add" ? addMemberAction.bind(null, groupId, participantId)
    : operation === "remove" ? removeMemberAction.bind(null, groupId, participantId)
    : operation === "transfer" ? transferAdminAction.bind(null, groupId, participantId)
    : operation === "leave" ? leaveGroupAction.bind(null, groupId) : closeGroupAction.bind(null, groupId);
  const [state, submit, pending] = useActionState<GroupActionState, FormData>(action, { message: "" });
  const error = state.message ? <p role="alert" className="mt-3 rounded-lg bg-error-bg p-3 text-sm text-error">{state.message}</p> : null;
  if (operation === "add") return <form action={submit} aria-busy={pending}><button type="submit" disabled={pending} className="min-h-12 rounded-lg border border-ink px-4 py-3 text-sm hover:bg-soft disabled:opacity-65">{pending ? "Adicionando…" : labels.add}</button>{error}</form>;
  const description = operation === "remove" ? `“${participantName}” será removido deste grupo.`
    : operation === "transfer" ? `“${participantName}” passará a administrar o grupo. Você perderá as permissões administrativas.`
    : operation === "leave" ? "Você deixará de participar deste grupo. O administrador poderá adicionar você novamente."
    : "O grupo será encerrado. Seus presentes e sua conta serão preservados. Esta ação não pode ser desfeita.";
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="min-h-12 py-3 text-left text-sm text-accent underline underline-offset-4">{labels[operation]}</button>
      {/* A confirmação é de intenção. Sessão, papel e composição são relidos no
          backend, inclusive se o cliente adulterar IDs ou tentar pular o diálogo. */}
      <dialog ref={dialog} aria-label={labels[operation]} onCancel={(event) => { if (pending) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-line bg-paper p-6 text-ink shadow-xl backdrop:bg-ink/50">
        <h2 className="font-display text-2xl">{labels[operation]}?</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted wrap-anywhere">{description}</p>
        <form action={submit} aria-busy={pending} className="mt-6">
          {error}
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => dialog.current?.close()} disabled={pending} className="min-h-12 rounded-lg border border-ink px-4 py-3 text-sm disabled:opacity-65">Cancelar</button>
            <button type="submit" name="confirm" value="confirmar" disabled={pending} className="min-h-12 rounded-lg bg-accent px-4 py-3 text-sm text-white disabled:opacity-65">{pending ? "Aguarde…" : "Confirmar"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
