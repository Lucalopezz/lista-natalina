"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createGroupAction, updateGroupAction } from "../actions";
import type { GroupActionState, GroupView } from "../types";

const inputClass = "min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base text-ink disabled:opacity-60";
const groupTypes = [
  { value: "conventional", label: "Lista em grupo", description: "Para organizar presentes entre família e amigos, sem sorteio." },
  { value: "secret_santa", label: "Amigo secreto", description: "Cada pessoa terá alguém para presentear quando o sorteio estiver disponível." },
] as const;
export function GroupForm({ group }: { group?: GroupView }) {
  const [state, submit, pending] = useActionState<GroupActionState, FormData>(group ? updateGroupAction.bind(null, group.id) : createGroupAction, { message: "" });
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [type, setType] = useState(group?.type ?? "conventional");
  return (
    <form action={submit} aria-busy={pending} className="mt-6 grid gap-6 rounded-xl border border-line bg-field p-5 sm:p-6">
      <div className="grid gap-2">
        <label htmlFor="group-name" className="font-bold">Nome do grupo</label>
        <input id="group-name" name="name" required maxLength={120} placeholder="Ex.: Natal da família" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} className={inputClass} aria-invalid={Boolean(state.fields?.name)} aria-describedby={state.fields?.name ? "group-name-error" : undefined} />
        {state.fields?.name && <p id="group-name-error" className="text-error">{state.fields.name[0]}</p>}
      </div>
      {group ? <p className="text-muted">Tipo: {group.type === "conventional" ? "Lista em grupo" : "Amigo secreto"}. O tipo não pode ser alterado.</p> : (
        <fieldset className="grid gap-3" aria-describedby={state.fields?.type ? "group-type-error" : undefined}>
          <legend className="mb-3 font-bold">Tipo do grupo</legend>
          {groupTypes.map((option) => (
            <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 ${type === option.value ? "border-ink bg-soft" : "border-line"}`}>
              <input type="radio" name="type" value={option.value} checked={type === option.value} onChange={() => setType(option.value)} disabled={pending} className="mt-1 size-6 shrink-0 accent-ink" aria-labelledby={`${option.value}-label`} aria-describedby={`${option.value}-hint`} />
              <span><span id={`${option.value}-label`} className="block font-bold">{option.label}</span><span id={`${option.value}-hint`} className="mt-1 block leading-relaxed text-muted">{option.description}</span></span>
            </label>
          ))}
          {state.fields?.type && <p id="group-type-error" className="text-error">{state.fields.type[0]}</p>}
          <p className="text-base leading-relaxed text-muted">Por enquanto, você pode criar grupos e adicionar pessoas. As listas já podem ser acessadas nos grupos sem sorteio. O sorteio de amigo secreto ainda não está disponível.</p>
        </fieldset>
      )}
      <div className="grid gap-2">
        <label htmlFor="group-description" className="font-bold">Descrição (opcional)</label>
        <textarea id="group-description" name="description" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={pending} className={`${inputClass} min-h-28 resize-y`} aria-invalid={Boolean(state.fields?.description)} aria-describedby={`description-hint${state.fields?.description ? " group-description-error" : ""}`} />
        <p id="description-hint" className="leading-relaxed text-muted">Se quiser, escreva uma mensagem para as pessoas do grupo.</p>
        {state.fields?.description && <p id="group-description-error" className="text-error">{state.fields.description[0]}</p>}
      </div>
      {state.message && <p role="alert" className="rounded-lg bg-error-bg p-4 text-error">{state.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="submit" disabled={pending} className="min-h-12 rounded-lg bg-ink px-5 py-3 text-base font-bold text-white hover:bg-ink/90 disabled:opacity-65">{pending ? "Salvando…" : group ? "Salvar alterações" : "Criar grupo"}</button>
        <Link href={group ? `/grupos/${group.id}` : "/grupos"} className="flex min-h-12 items-center justify-center rounded-lg border border-ink px-5 py-3 text-base underline underline-offset-4">Cancelar</Link>
      </div>
    </form>
  );
}
