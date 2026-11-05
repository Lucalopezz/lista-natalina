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
    <section className="py-8" aria-labelledby="wishlist-title">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 id="wishlist-title" className="text-3xl font-bold">Minha lista de presentes</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">Estes são os presentes que você gostaria de ganhar. Use “Adicionar presente” para colocar um novo item na lista.</p>
        </div>
        <Link href="/presentes/novo" className="inline-flex min-h-12 items-center rounded-lg bg-ink px-5 py-3 text-base text-white hover:bg-ink/90">Adicionar presente</Link>
      </div>
      {message && <p role="status" className="mt-6 rounded-xl border border-ink/15 bg-soft p-4 text-base">{message}</p>}
      {page.gifts.length > 0 ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {page.gifts.map((gift) => <GiftCard key={gift.id} gift={gift} />)}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-ink/25 bg-soft/50 px-6 py-8 text-center">
          <span aria-hidden="true" className="text-4xl">🎁</span>
          <h2 className="mt-5 font-display text-2xl">{query.cursor ? "Você chegou ao fim desta página." : "Você ainda não adicionou presentes."}</h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted">Para começar, use o botão “Adicionar presente” acima.</p>
        </div>
      )}
      <nav aria-label="Páginas da lista" className="mt-8 flex flex-wrap justify-between gap-4">
        {query.cursor && <Link href="/presentes" className="py-3 text-base underline underline-offset-4">Voltar ao início</Link>}
        {page.nextCursor && <Link href={`/presentes?cursor=${page.nextCursor}`} className="ml-auto py-3 text-base font-bold text-accent underline underline-offset-4">Ver mais presentes →</Link>}
      </nav>
    </section>
  );
}
