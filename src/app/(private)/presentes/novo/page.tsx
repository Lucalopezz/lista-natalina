import Link from "next/link";
import { requireCurrentUser } from "@/modules/auth/session";
import { GiftForm } from "@/modules/gifts/components/gift-form";

export const metadata = { title: "Adicionar presente | Lista Natalina" };
export default async function NewGiftPage() {
  await requireCurrentUser();
  return (
    <section className="max-w-2xl py-10 md:py-12">
      <Link href="/presentes" className="inline-block py-3 text-sm text-muted underline underline-offset-4">← Minha lista</Link>
      <h1 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">Um novo desejo.</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">Deixe as pistas para quem quiser surpreender você.</p>
      <GiftForm />
    </section>
  );
}
