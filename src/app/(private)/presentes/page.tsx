import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/modules/auth/session";
import { getGiftService } from "@/modules/gifts/server";
import { giftQuerySchema } from "@/modules/gifts/validation";
import { GiftCard } from "@/modules/gifts/components/gift-card";

export const metadata = { title: "Minha lista | Lista Natalina" };
const feedback = (status: unknown) => status === "criado" ? "Presente adicionado à sua lista."
  : status === "atualizado" ? "Presente atualizado." : status === "excluido" ? "Presente excluído." : null;

export default async function GiftsPage({ searchParams }: { searchParams: Promise<{ cursor?: string | string[]; status?: string | string[] }> }) {
  const user = await requireCurrentUser();
  const query = await searchParams;
  const parsed = giftQuerySchema.safeParse({ cursor: query.cursor });
  if (!parsed.success) redirect("/presentes");
  const page = await (await getGiftService()).list(user.id, parsed.data);
  const message = feedback(query.status);

  return (
    <section className="py-10 md:py-12" aria-labelledby="wishlist-title">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-[11px] font-bold tracking-[2px] text-accent uppercase">Pequenas ideias, grandes sorrisos</p>
          <h1 id="wishlist-title" className="mt-4 font-display text-4xl tracking-tight md:text-5xl">Minha lista de presentes.</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">Reúna seus desejos e os detalhes que tornam cada escolha especial.</p>
        </div>
        <Link href="/presentes/novo" className="inline-flex min-h-12 items-center rounded-lg bg-accent px-5 py-3 text-sm text-white hover:bg-[#8e182d]">Adicionar presente</Link>
      </div>
      {message && <p role="status" className="mt-6 rounded-xl border border-ink/15 bg-soft p-4 text-sm">{message}</p>}
      {page.gifts.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {page.gifts.map((gift) => <GiftCard key={gift.id} gift={gift} />)}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-ink/25 bg-soft/50 px-6 py-14 text-center">
          <span aria-hidden="true" className="text-4xl">🎁</span>
          <h2 className="mt-5 font-display text-2xl">{query.cursor ? "Você chegou ao fim desta página." : "Sua lista começa com um desejo."}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">Adicione links e detalhes para facilitar a escolha de quem vai presentear você.</p>
        </div>
      )}
      <nav aria-label="Páginas da lista" className="mt-8 flex flex-wrap justify-between gap-4">
        {query.cursor && <Link href="/presentes" className="py-3 text-sm underline underline-offset-4">Voltar ao início</Link>}
        {page.nextCursor && <Link href={`/presentes?cursor=${page.nextCursor}`} className="ml-auto py-3 text-sm font-bold text-accent underline underline-offset-4">Ver mais presentes →</Link>}
      </nav>
    </section>
  );
}
