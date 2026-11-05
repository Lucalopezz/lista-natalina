"use client";

import { useActionState, useRef } from "react";
import { deleteGiftAction } from "../actions";
import type { GiftActionState } from "../types";

export function DeleteGiftButton({ id, name }: { id: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, submit, pending] = useActionState<GiftActionState, FormData>(deleteGiftAction.bind(null, id), { message: "" });
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="min-h-12 rounded-lg border border-line px-5 py-3 text-base text-accent underline underline-offset-4">Excluir</button>
      {/* O dialog nativo cuida de foco, Escape e fundo inerte. O formulário só
          confirma a intenção; a action ainda valida sessão, ID e proprietário. */}
      <dialog ref={dialog} aria-labelledby={`delete-title-${id}`} onCancel={(event) => { if (pending) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-line bg-paper p-6 text-ink shadow-xl backdrop:bg-ink/50">
        <h2 id={`delete-title-${id}`} className="text-2xl font-bold">Excluir presente?</h2>
        <p className="mt-4 text-base leading-relaxed text-muted wrap-anywhere">“{name}” será removido da sua lista. Esta ação não pode ser desfeita.</p>
        <form action={submit} aria-busy={pending} className="mt-6">
          {state.message && <p className="mb-4 rounded-lg bg-error-bg p-3 text-base text-error" role="alert">{state.message}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="min-h-12 rounded-lg border border-ink px-4 py-3 text-base disabled:opacity-65">Cancelar</button>
            <button type="submit" name="confirm" value="excluir" disabled={pending} className="min-h-12 rounded-lg bg-accent px-4 py-3 text-base text-white hover:bg-[#8e182d] disabled:opacity-65">{pending ? "Excluindo…" : "Excluir presente"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
