import Link from "next/link";
import type { GroupView } from "../types";

export function GroupCard({ group }: { group: GroupView }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-line bg-field p-6">
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-soft px-3 py-1.5">{group.type === "conventional" ? "Convencional" : "Amigo secreto"}</span>{group.type === "secret_santa" && <span className="rounded-full bg-gold/10 px-3 py-1.5 text-gold">{group.hasActiveDraw ? "Sorteio ativo" : "Sem sorteio"}</span>}</div>
      <h2 className="mt-5 font-display text-2xl wrap-anywhere">{group.name}</h2>
      {group.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted wrap-anywhere">{group.description}</p>}
      <p className="mt-4 text-sm text-muted">{group.memberCount} {group.memberCount === 1 ? "participante" : "participantes"}</p>
      <Link href={`/grupos/${group.id}`} className="mt-auto pt-5 pb-2 text-sm font-bold text-accent underline underline-offset-4">Acessar grupo →</Link>
    </article>
  );
}
