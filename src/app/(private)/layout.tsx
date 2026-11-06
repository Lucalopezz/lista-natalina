import { Brand } from "@/components/brand";
import { AccountNav } from "@/components/account-nav";
import { requireCurrentUser } from "@/modules/auth/session";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";

export const metadata = { robots: { index: false, follow: false } };

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireCurrentUser();
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <a href="#conteudo" className="sr-only rounded-lg bg-ink p-4 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50">Pular para o conteúdo</a>
      <header className="border-b border-line py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Brand href="/dashboard" /><SignOutButton /></div>
        <AccountNav />
      </header>
      <main id="conteudo" tabIndex={-1} className="pb-10 focus:outline-none">{children}</main>
    </div>
  );
}
