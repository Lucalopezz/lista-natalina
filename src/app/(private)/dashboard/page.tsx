import Link from "next/link";
import { getGroupService } from "@/modules/groups/server";
import { GroupCard } from "@/modules/groups/components/group-card";
import { requireCurrentUser } from "@/modules/auth/session";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const groups = await (await getGroupService()).list(user.id);
  return (
    <section className="py-12">
      <p className="text-[11px] font-bold tracking-[2px] text-accent uppercase">Um lugar para suas pessoas e seus desejos</p>
      <h1 className="my-6 font-display text-[clamp(32px,5vw,48px)] leading-tight tracking-tight wrap-anywhere">Olá, {user.name}.</h1>
      <p className="max-w-xl leading-relaxed text-muted">Que bom ter você por aqui. Comece reunindo ideias para os próximos bons encontros.</p>
      <section className="mt-10" aria-labelledby="my-groups-title">
        <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="my-groups-title" className="font-display text-3xl">Meus grupos</h2><Link href="/grupos/novo" className="inline-flex min-h-12 items-center rounded-lg bg-accent px-5 py-3 text-sm text-white">Criar grupo</Link></div>
        {groups.items.length ? <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{groups.items.map((group) => <GroupCard key={group.id} group={group} />)}</div> : <p className="mt-5 rounded-xl border border-dashed border-ink/25 bg-soft/50 p-6 text-sm leading-relaxed text-muted">Você ainda não participa de um grupo. Crie um encontro ou peça para um administrador adicionar você.</p>}
        {groups.nextCursor && <Link href="/grupos" className="mt-3 inline-block py-3 text-sm text-accent underline underline-offset-4">Ver todos os grupos →</Link>}
      </section>
      <div className="mt-8 max-w-xl rounded-2xl border border-line bg-soft/60 p-6">
        <p aria-hidden="true" className="text-3xl">🎁</p>
        <h2 className="mt-4 font-display text-2xl">Minha lista de presentes</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">Livros, pequenos detalhes ou aquele desejo especial. Deixe as pistas de quem você é.</p>
        <Link className="mt-4 inline-block py-3 text-sm font-bold text-accent underline underline-offset-4" href="/presentes">Ver minha lista →</Link>
      </div>
    </section>
  );
}
