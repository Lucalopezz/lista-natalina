import { Brand } from "@/components/brand";
import Link from "next/link";
import { requireCurrentUser } from "@/modules/auth/session";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireCurrentUser();
  return <main className="mx-auto max-w-[1160px] px-6 pt-7 md:px-12 md:pt-10"><header className="flex flex-wrap items-center gap-5 border-b border-line pb-6"><Brand href="/dashboard" /><nav className="mr-auto flex flex-wrap gap-5 [&_a]:py-3 [&_a]:text-sm [&_a]:underline [&_a]:underline-offset-4" aria-label="Navegação da conta"><Link href="/dashboard">Início</Link><Link href="/perfil">Meu perfil</Link></nav><SignOutButton /></header>{children}</main>;
}
