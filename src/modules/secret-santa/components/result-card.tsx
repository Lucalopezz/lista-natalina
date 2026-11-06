import Link from "next/link";
import type { GroupView } from "../../groups/types";
export function SecretSantaCard({ group }: { group: GroupView }) {
  return <article className="rounded-xl border border-line bg-field p-5"><h3 className="text-2xl font-bold wrap-anywhere">{group.name}</h3><Link href={`/grupos/${group.id}/amigo-secreto`} className="mt-4 flex min-h-12 items-center justify-center rounded-lg bg-ink px-5 py-3 font-bold text-white">Ver meu amigo secreto</Link></article>;
}
