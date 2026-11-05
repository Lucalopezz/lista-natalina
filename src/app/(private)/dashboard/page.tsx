import Link from "next/link";
import { getGroupService } from "@/modules/groups/server";
import { GroupCard } from "@/modules/groups/components/group-card";
import { requireCurrentUser } from "@/modules/auth/session";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const groups = await (await getGroupService()).list(user.id);
  return (
    <section className="py-8">
      <h1 className="text-3xl leading-tight font-bold wrap-anywhere">Olá, {user.name}.</h1>
      <p className="mt-3 text-muted">O que você quer fazer?</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-field p-5 sm:p-6" aria-labelledby="my-list-title">
          <h2 id="my-list-title" className="text-2xl font-bold">Minha lista de presentes</h2>
          <p className="mt-3 leading-relaxed text-muted">Adicione o que você gostaria de ganhar. Você pode mudar sua lista quando quiser.</p>
          <Link href="/presentes" className="mt-5 flex min-h-12 items-center justify-center rounded-lg bg-ink px-5 py-3 text-base font-bold text-white hover:bg-ink/90">Ver minha lista</Link>
        </section>
        <section className="rounded-xl border border-line bg-field p-5 sm:p-6" aria-labelledby="create-group-title">
          <h2 id="create-group-title" className="text-2xl font-bold">Reunir família e amigos</h2>
          <p className="mt-3 leading-relaxed text-muted">Crie um grupo e adicione pessoas que já têm uma conta.</p>
          <Link href="/grupos/novo" className="mt-5 flex min-h-12 items-center justify-center rounded-lg border-2 border-ink px-5 py-3 text-base font-bold hover:bg-soft">Criar grupo</Link>
        </section>
      </div>
      <section className="mt-10" aria-labelledby="my-groups-title">
        <h2 id="my-groups-title" className="text-2xl font-bold">Meus grupos</h2>
        {groups.items.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{groups.items.map((group) => <GroupCard key={group.id} group={group} />)}</div> : (
          <p className="mt-4 rounded-xl border border-line bg-field p-5 leading-relaxed text-muted">Você ainda não participa de nenhum grupo. Use o botão “Criar grupo” acima ou peça ao responsável por um grupo para adicionar você.</p>
        )}
        {groups.nextCursor && <Link href="/grupos" className="mt-4 inline-flex min-h-12 items-center py-3 font-bold underline underline-offset-4">Ver todos os grupos</Link>}
      </section>
    </section>
  );
}
