import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/modules/auth/session";
import { getGroupService } from "@/modules/groups/server";
import { GroupError } from "@/modules/groups/service";
import { GroupForm } from "@/modules/groups/components/group-form";
import type { GroupView } from "@/modules/groups/types";
export const metadata = { title: "Editar grupo | Lista Natalina" };
export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  let group: GroupView;
  try { group = (await (await getGroupService()).get(user.id, id)).group; }
  catch (error) { if (error instanceof GroupError && error.code === "not_found") notFound(); throw error; }
  if (group.adminId !== user.id) notFound();
  return <section className="max-w-2xl py-8"><Link href={`/grupos/${group.id}`} className="inline-block py-3 text-base text-muted underline underline-offset-4">← Voltar ao grupo</Link><h1 className="mt-3 text-3xl font-bold">Editar grupo</h1><GroupForm key={group.id} group={group} /></section>;
}
