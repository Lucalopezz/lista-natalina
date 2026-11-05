import Link from "next/link";
import { requireCurrentUser } from "@/modules/auth/session";
import { GiftForm } from "@/modules/gifts/components/gift-form";

export const metadata = { title: "Adicionar presente | Lista Natalina" };
export default async function NewGiftPage() {
  await requireCurrentUser();
  return (
    <section className="max-w-2xl py-8">
      <Link href="/presentes" className="inline-block py-3 text-base text-muted underline underline-offset-4">← Minha lista</Link>
      <h1 className="mt-3 text-3xl font-bold">Adicionar presente</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">Conte o que você gostaria de ganhar.</p>
      <GiftForm />
    </section>
  );
}
