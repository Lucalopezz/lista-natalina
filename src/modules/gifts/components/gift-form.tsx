"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createGiftAction, updateGiftAction } from "../actions";
import type { GiftActionState, GiftView } from "../types";
import type { GiftField } from "../validation";

const inputClass = "min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base text-ink disabled:opacity-60";

export function GiftForm({ gift }: { gift?: GiftView }) {
  const action = gift ? updateGiftAction.bind(null, gift.id) : createGiftAction;
  const [state, submit, pending] = useActionState<GiftActionState, FormData>(action, { message: "" });
  // Campos controlados preservam o que foi digitado quando uma ação retorna erros.
  // O reset automático dos forms do React não deve apagar um cadastro rejeitado.
  const [values, setValues] = useState({
    name: gift?.name ?? "", description: gift?.description ?? "",
    productUrl: gift?.productUrl ?? "", imageUrl: gift?.imageUrl ?? "",
  });
  // Quem já tem imagem precisa encontrá-la ao editar. Um erro no campo também
  // abre a seção; nenhum erro de validação pode ficar escondido no formulário.
  const [imageOpen, setImageOpen] = useState(Boolean(gift?.imageUrl));
  const change = (field: GiftField, value: string) => setValues((previous) => ({ ...previous, [field]: value }));

  return (
    <form action={submit} className="mt-6 grid gap-6 rounded-xl border border-line bg-field p-5 sm:p-6" aria-busy={pending}>
      <p className="leading-relaxed text-muted">Preencha nome, descrição e link do produto.</p>
      <div className="grid gap-2">
        <label className="font-bold" htmlFor="name">Nome do presente</label>
        <input className={inputClass} id="name" name="name" required maxLength={120} value={values.name} onChange={(event) => change("name", event.target.value)} disabled={pending} placeholder="Ex.: Livro de receitas" aria-invalid={Boolean(state.fields?.name)} aria-describedby={state.fields?.name ? "name-error" : undefined} />
        {state.fields?.name && <p id="name-error" className="text-error">{state.fields.name[0]}</p>}
      </div>
      <div className="grid gap-2">
        <label className="font-bold" htmlFor="description">Descrição</label>
        <textarea id="description" name="description" className={`${inputClass} min-h-28 resize-y`} required maxLength={2000}
          value={values.description} onChange={(event) => change("description", event.target.value)} disabled={pending}
          placeholder="Ex.: Tamanho M, na cor azul." aria-invalid={Boolean(state.fields?.description)}
          aria-describedby={`description-hint${state.fields?.description ? " description-error" : ""}`} />
        <p id="description-hint" className="text-base leading-relaxed text-muted">Escreva detalhes como tamanho, cor ou modelo.</p>
        {state.fields?.description && <p id="description-error" className="text-error">{state.fields.description[0]}</p>}
      </div>
      <div className="grid gap-2">
        <label className="font-bold" htmlFor="productUrl">Link do produto</label>
        <input className={inputClass} id="productUrl" name="productUrl" type="url" required maxLength={2048}
          value={values.productUrl} onChange={(event) => change("productUrl", event.target.value)} disabled={pending}
          placeholder="https://loja.com/produto" autoCapitalize="none" spellCheck={false}
          aria-invalid={Boolean(state.fields?.productUrl)} aria-describedby={`product-hint${state.fields?.productUrl ? " productUrl-error" : ""}`} />
        <p id="product-hint" className="text-base leading-relaxed text-muted">Copie o endereço da página do produto na loja e cole aqui.</p>
        {state.fields?.productUrl && <p id="productUrl-error" className="text-error">{state.fields.productUrl[0]}</p>}
      </div>
      <details open={imageOpen || Boolean(state.fields?.imageUrl)} onToggle={(event) => setImageOpen(event.currentTarget.open)} className="rounded-lg border border-line p-4">
        <summary className="min-h-12 cursor-pointer py-3 font-bold underline underline-offset-4">Adicionar uma imagem (opcional)</summary>
        <div className="mt-3 grid gap-2">
          <label htmlFor="imageUrl" className="font-bold">Link da imagem (opcional)</label>
          <input className={inputClass} id="imageUrl" name="imageUrl" type="url" maxLength={2048}
            value={values.imageUrl} onChange={(event) => change("imageUrl", event.target.value)} disabled={pending}
            placeholder="https://loja.com/imagem.jpg" autoCapitalize="none" spellCheck={false}
            aria-invalid={Boolean(state.fields?.imageUrl)} aria-describedby={`image-hint${state.fields?.imageUrl ? " imageUrl-error" : ""}`} />
          <p id="image-hint" className="leading-relaxed text-muted">Pode deixar em branco. Vamos mostrar uma imagem de presente.</p>
          {state.fields?.imageUrl && <p id="imageUrl-error" className="text-error">{state.fields.imageUrl[0]}</p>}
        </div>
      </details>
      {state.message && <p role="alert" className="rounded-lg bg-error-bg p-4 text-error">{state.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="submit" disabled={pending} className="min-h-12 rounded-lg bg-ink px-5 py-3 text-base font-bold text-white hover:bg-ink/90 disabled:cursor-wait disabled:opacity-65">{pending ? "Salvando…" : gift ? "Salvar alterações" : "Salvar presente"}</button>
        <Link href="/presentes" className="flex min-h-12 items-center justify-center rounded-lg border border-ink px-5 py-3 text-base underline underline-offset-4">Cancelar</Link>
      </div>
    </form>
  );
}
