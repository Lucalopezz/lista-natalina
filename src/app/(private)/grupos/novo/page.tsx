import Link from "next/link";
import { requireCurrentUser } from "@/modules/auth/session";
import { GroupForm } from "@/modules/groups/components/group-form";
export const metadata = { title: "Criar grupo | Lista Natalina" };
export default async function NewGroupPage() {
  await requireCurrentUser();
  return <section className="max-w-2xl py-8"><Link href="/grupos" className="inline-block py-3 text-base text-muted underline underline-offset-4">← Meus grupos</Link><h1 className="mt-3 text-3xl font-bold">Criar grupo</h1><p className="mt-4 text-base leading-relaxed text-muted">Depois de criar o grupo, você poderá adicionar as pessoas.</p><GroupForm /></section>;
}
