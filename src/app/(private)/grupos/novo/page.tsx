import Link from "next/link";
import { requireCurrentUser } from "@/modules/auth/session";
import { GroupForm } from "@/modules/groups/components/group-form";
export const metadata = { title: "Criar grupo | Lista Natalina" };
export default async function NewGroupPage() {
  await requireCurrentUser();
  return <section className="max-w-2xl py-10"><Link href="/grupos" className="inline-block py-3 text-sm text-muted underline underline-offset-4">← Meus grupos</Link><h1 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">Um novo encontro.</h1><p className="mt-4 text-sm leading-relaxed text-muted">Escolha um nome e reúna suas pessoas favoritas.</p><GroupForm /></section>;
}
