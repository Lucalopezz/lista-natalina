"use client";
import { useActionState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { drawAction } from "../actions";
import { MIN_PARTICIPANTS } from "../constants";
import type { DrawOperation } from "../validation";
import type { DrawActionState, DrawStatus } from "../types";

const labels = { start: "Realizar sorteio", redraw: "Refazer sorteio", invalidate: "Cancelar sorteio" };
const confirmations = { start: "Sim, realizar sorteio", redraw: "Sim, refazer sorteio", invalidate: "Sim, cancelar sorteio" };
const descriptions = {
  start: "Cada participante receberá uma pessoa para presentear. Depois do sorteio, ninguém poderá entrar ou sair até ele ser cancelado.",
  redraw: "Os resultados atuais e todas as reservas deste amigo secreto serão cancelados. Um novo sorteio será feito para as mesmas pessoas.",
  invalidate: "Os resultados atuais e as reservas deste amigo secreto serão cancelados. Depois, você poderá adicionar ou remover pessoas e realizar outro sorteio.",
};
function DrawButton({ groupId, status, operation }: { groupId: string; status: DrawStatus; operation: DrawOperation }) {
  const dialog = useRef<HTMLDialogElement>(null), router = useRouter();
  const [refreshing, refresh] = useTransition();
  const [state, submit, pending] = useActionState<DrawActionState, FormData>(drawAction.bind(null, groupId, operation, { revision: status.revision, compositionVersion: status.compositionVersion }), { message: "" });
  const disabled = operation !== "invalidate" && status.memberCount < MIN_PARTICIPANTS;
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => dialog.current?.showModal()} className="min-h-12 rounded-lg border border-ink px-5 py-3 text-base font-bold disabled:opacity-60">{labels[operation]}</button>
      <dialog ref={dialog} aria-label={labels[operation]} onCancel={(event) => { if (pending) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-xl border border-line bg-paper p-6 text-ink shadow-xl backdrop:bg-ink/50">
        <h3 className="text-2xl font-bold">{labels[operation]}?</h3>
        <p className="mt-4 leading-relaxed text-muted">{descriptions[operation]}</p>
        <form action={submit} aria-busy={pending} className="mt-5 grid gap-3">
          {/* A revisão bound não é autorização. O backend compara estado e
              composição atuais, para a confirmação não atingir outra edição. */}
          {state.message && <div className="rounded-lg bg-error-bg p-4"><p role="alert" className="text-error">{state.message}</p><button type="button" onClick={() => refresh(() => router.refresh())} disabled={pending || refreshing} className="mt-3 min-h-12 rounded-lg border border-ink px-4 py-3 underline underline-offset-4">{refreshing ? "Atualizando…" : "Atualizar grupo"}</button></div>}
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="min-h-12 rounded-lg border border-ink px-5 py-3 text-base disabled:opacity-60">Voltar</button>
          <button type="submit" name="confirm" value={operation} disabled={pending} className="min-h-12 rounded-lg bg-accent px-5 py-3 text-base font-bold text-white disabled:opacity-60">{pending ? "Aguarde…" : confirmations[operation]}</button>
        </form>
      </dialog>
    </>
  );
}
export function DrawControls({ groupId, status }: { groupId: string; status: DrawStatus }) {
  return (
    <section aria-labelledby="draw-management" className="mt-6 rounded-xl border border-line bg-field p-5">
      <h2 id="draw-management" className="text-2xl font-bold">Gerenciar sorteio</h2>
      <p className="mt-3 leading-relaxed text-muted">{status.hasActiveDraw ? "Você pode refazer o sorteio ou cancelá-lo para mudar os participantes." : "Confira os participantes antes de realizar o sorteio. São necessárias pelo menos três pessoas."}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(status.hasActiveDraw ? ["redraw", "invalidate"] as const : ["start"] as const).map((operation) => <DrawButton key={`${status.revision}-${status.compositionVersion}-${operation}`} groupId={groupId} status={status} operation={operation} />)}
      </div>
    </section>
  );
}
