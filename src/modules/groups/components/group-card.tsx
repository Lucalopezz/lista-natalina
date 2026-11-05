import Link from "next/link";
import type { GroupView } from "../types";

export function GroupCard({ group }: { group: GroupView }) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-line bg-field p-5 sm:p-6">
      <h2 className="text-2xl font-bold wrap-anywhere">{group.name}</h2>
      <p className="mt-2 text-base text-muted">{group.type === "conventional" ? "Lista em grupo" : "Amigo secreto"} · {group.memberCount} {group.memberCount === 1 ? "participante" : "participantes"}</p>
      {group.type === "secret_santa" && <p className="mt-2 text-base font-bold">{group.hasActiveDraw ? "O sorteio já foi feito." : "O sorteio ainda não foi feito."}</p>}
      {group.description && <p className="mt-3 line-clamp-3 leading-relaxed text-muted wrap-anywhere">{group.description}</p>}
      <Link href={`/grupos/${group.id}`} className="mt-5 flex min-h-12 items-center justify-center rounded-lg border-2 border-ink px-4 py-3 text-base font-bold hover:bg-soft">Abrir grupo</Link>
    </article>
  );
}
