import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/modules/auth/session";
import { getGiftService } from "@/modules/gifts/server";
import { GiftError } from "@/modules/gifts/service";
import type { GiftView } from "@/modules/gifts/types";
import { GiftForm } from "@/modules/gifts/components/gift-form";

export const metadata = { title: "Editar presente | Lista Natalina" };
export default async function EditGiftPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  let gift: GiftView;
  try { gift = await (await getGiftService()).get(user.id, id); }
  catch (error) {
    // A mesma página 404 serve para ID inexistente ou alheio: conhecer o ID
    // não revela o título, a imagem ou sequer a existência da lista de outra pessoa.
    if (error instanceof GiftError && error.code === "not_found") notFound();
    throw error;
  }
  return (
    <section className="max-w-2xl py-8">
      <Link href="/presentes" className="inline-block py-3 text-base text-muted underline underline-offset-4">← Minha lista</Link>
      <h1 className="mt-3 text-3xl font-bold">Editar presente</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">Altere os campos e depois use “Salvar alterações”.</p>
      <GiftForm key={gift.id} gift={gift} />
    </section>
  );
}
