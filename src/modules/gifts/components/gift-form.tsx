"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createGiftAction, updateGiftAction } from "../actions";
import type { GiftActionState, GiftView } from "../types";
import type { GiftField } from "../validation";

const inputClass = "min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base text-ink disabled:opacity-60";
const fields = [
  { name: "name", label: "Nome do presente", type: "text", max: 120, placeholder: "Ex.: Livro de receitas" },
  { name: "productUrl", label: "Link do produto", type: "url", max: 2048, placeholder: "https://loja.com/produto" },
  { name: "imageUrl", label: "URL da imagem", type: "url", max: 2048, placeholder: "https://loja.com/imagem.jpg" },
] as const;

export function GiftForm({ gift }: { gift?: GiftView }) {
  const action = gift ? updateGiftAction.bind(null, gift.id) : createGiftAction;
  const [state, submit, pending] = useActionState<GiftActionState, FormData>(action, { message: "" });
  // Campos controlados preservam o que foi digitado quando uma ação retorna erros.
  // O reset automático dos forms do React não deve apagar um cadastro rejeitado.
  const [values, setValues] = useState({
    name: gift?.name ?? "", description: gift?.description ?? "",
    productUrl: gift?.productUrl ?? "", imageUrl: gift?.imageUrl ?? "",
  });
  const change = (field: GiftField, value: string) => setValues((previous) => ({ ...previous, [field]: value }));

  return (
    <form action={submit} className="mt-8 grid gap-6" aria-busy={pending}>
      {fields.map((field) => {
        const error = state.fields?.[field.name]?.[0];
        return (
          <div className="grid gap-2.5" key={field.name}>
            <label className="text-sm font-bold" htmlFor={field.name}>{field.label}{field.name === "imageUrl" ? " (opcional)" : ""}</label>
            <input
              className={inputClass} id={field.name} name={field.name} type={field.type}
              value={values[field.name]} onChange={(event) => change(field.name, event.target.value)}
              required={field.name !== "imageUrl"} maxLength={field.max} placeholder={field.placeholder} disabled={pending}
              autoCapitalize={field.type === "url" ? "none" : "sentences"}
              spellCheck={field.type !== "url"} aria-invalid={Boolean(error)}
              aria-describedby={error ? `${field.name}-error` : undefined}
            />
            {error && <p id={`${field.name}-error`} className="text-sm text-error">{error}</p>}
          </div>
        );
      })}
      <div className="grid gap-2.5">
        <label className="text-sm font-bold" htmlFor="description">Descrição</label>
        <textarea
          id="description" name="description" className={`${inputClass} min-h-32 resize-y`} required maxLength={2000}
          value={values.description} onChange={(event) => change("description", event.target.value)}
          placeholder="Conte detalhes como tamanho, cor ou edição." disabled={pending}
          aria-invalid={Boolean(state.fields?.description)}
          aria-describedby={state.fields?.description ? "description-error" : undefined}
        />
        {state.fields?.description && <p id="description-error" className="text-sm text-error">{state.fields.description[0]}</p>}
      </div>
      <p className="text-sm leading-relaxed text-muted">Use links HTTP ou HTTPS. A imagem é opcional: se ficar vazia, usaremos uma ilustração de presente.</p>
      {state.message && <p role="alert" className="rounded-lg bg-error-bg p-3.5 text-sm text-error">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-5">
        <button type="submit" disabled={pending} className="min-h-12 rounded-lg bg-accent px-6 py-3 text-sm text-white hover:bg-[#8e182d] disabled:cursor-wait disabled:opacity-65">
          {pending ? "Salvando…" : gift ? "Salvar alterações" : "Salvar presente"}
        </button>
        <Link href="/presentes" className="py-3 text-sm underline underline-offset-4">Cancelar</Link>
      </div>
    </form>
  );
}
