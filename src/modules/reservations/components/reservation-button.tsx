"use client";

import { useActionState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelReservationAction, reserveGiftAction } from "../actions";
import type { ReservationActionState } from "../types";

/** Nenhuma identidade/edição chega por props. O servidor refaz a autorização
 * mesmo que alguém altere o botão ou chame a action sem passar pela página. */
export function ReservationButton({ groupId, ownerId, giftId, cancel = false }: { groupId: string; ownerId: string; giftId: string; cancel?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const action = (cancel ? cancelReservationAction : reserveGiftAction).bind(null, groupId, ownerId, giftId);
  const [state, submit, pending] = useActionState<ReservationActionState, FormData>(action, { message: "" });
  const error = state.message ? (
    <div className="mt-3 rounded-lg bg-error-bg p-4">
      <p role="alert" className="text-base text-error">{state.message}</p>
      {/* Uma segunda pessoa pode reservar enquanto a tela está aberta. Recarregar
          o snapshot não repete a mutação e respeita as permissões atuais. */}
      <button type="button" disabled={pending || refreshing} onClick={() => startRefresh(() => router.refresh())} className="mt-3 min-h-12 rounded-lg border border-ink px-4 py-3 text-base underline underline-offset-4 disabled:opacity-65">{refreshing ? "Atualizando…" : "Atualizar lista"}</button>
    </div>
  ) : null;
  if (!cancel) return (
    <form action={submit} aria-busy={pending} className="w-full">
      <button type="submit" disabled={pending} className="min-h-12 w-full rounded-lg bg-ink px-5 py-3 text-base font-bold text-white hover:bg-ink/90 disabled:opacity-65">{pending ? "Reservando…" : "Reservar presente"}</button>
      {error}
    </form>
  );
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="min-h-12 w-full rounded-lg border border-ink px-5 py-3 text-base underline underline-offset-4">Cancelar minha reserva</button>
      <dialog ref={dialog} aria-label="Cancelar minha reserva" onCancel={(event) => { if (pending) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-line bg-paper p-6 text-ink shadow-xl backdrop:bg-ink/50">
        <h2 className="text-2xl font-bold">Cancelar esta reserva?</h2>
        <p className="mt-4 leading-relaxed text-muted">O presente ficará disponível para outras pessoas deste grupo. O dono não será avisado.</p>
        <form action={submit} aria-busy={pending} className="mt-5">
          {error}
          <div className="mt-4 grid gap-3">
            <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="min-h-12 rounded-lg border border-ink px-4 py-3 text-base disabled:opacity-65">Voltar</button>
            <button type="submit" name="confirm" value="cancelar" disabled={pending} className="min-h-12 rounded-lg bg-accent px-4 py-3 text-base font-bold text-white disabled:opacity-65">{pending ? "Cancelando…" : "Sim, cancelar reserva"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
