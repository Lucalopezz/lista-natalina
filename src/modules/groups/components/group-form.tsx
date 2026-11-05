"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createGroupAction, updateGroupAction } from "../actions";
import type { GroupActionState, GroupView } from "../types";

const inputClass = "min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base text-ink disabled:opacity-60";
export function GroupForm({ group }: { group?: GroupView }) {
  const [state, submit, pending] = useActionState<GroupActionState, FormData>(group ? updateGroupAction.bind(null, group.id) : createGroupAction, { message: "" });
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [type, setType] = useState(group?.type ?? "conventional");
  return (
    <form action={submit} aria-busy={pending} className="mt-8 grid gap-6">
      <div className="grid gap-2.5">
        <label htmlFor="group-name" className="text-sm font-bold">Nome do grupo</label>
        <input id="group-name" name="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={pending} className={inputClass} aria-invalid={Boolean(state.fields?.name)} aria-describedby={state.fields?.name ? "group-name-error" : undefined} />
        {state.fields?.name && <p id="group-name-error" className="text-sm text-error">{state.fields.name[0]}</p>}
      </div>
      <div className="grid gap-2.5">
        <label htmlFor="group-description" className="text-sm font-bold">Descrição</label>
        <textarea id="group-description" name="description" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={pending} className={`${inputClass} min-h-28 resize-y`} aria-describedby="description-hint" />
        <p id="description-hint" className="text-xs leading-relaxed text-muted">Opcional. Conte o que torna este encontro especial.</p>
        {state.fields?.description && <p className="text-sm text-error">{state.fields.description[0]}</p>}
      </div>
      {group ? <p className="text-sm text-muted">Tipo do grupo: {group.type === "conventional" ? "Convencional" : "Amigo secreto"}. Definido na criação.</p> : (
        <div className="grid gap-2.5">
          <label htmlFor="group-type" className="text-sm font-bold">Tipo do grupo</label>
          <select id="group-type" name="type" value={type} onChange={(event) => setType(event.target.value as typeof type)} disabled={pending} className={inputClass}>
            <option value="conventional">Convencional</option><option value="secret_santa">Amigo secreto</option>
          </select>
          {state.fields?.type && <p className="text-sm text-error">{state.fields.type[0]}</p>}
        </div>
      )}
      {state.message && <p role="alert" className="rounded-lg bg-error-bg p-4 text-sm text-error">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-5">
        <button type="submit" disabled={pending} className="min-h-12 rounded-lg bg-accent px-6 py-3 text-sm text-white hover:bg-[#8e182d] disabled:opacity-65">{pending ? "Salvando…" : group ? "Salvar alterações" : "Criar grupo"}</button>
        <Link href={group ? `/grupos/${group.id}` : "/grupos"} className="py-3 text-sm underline underline-offset-4">Cancelar</Link>
      </div>
    </form>
  );
}
