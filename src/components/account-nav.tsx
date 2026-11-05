"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Início" },
  { href: "/presentes", label: "Minha lista" },
  { href: "/grupos", label: "Meus grupos" },
  { href: "/perfil", label: "Meu perfil" },
];

/** Só o menu precisa conhecer a rota no navegador; o layout continua no servidor. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu principal" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {links.map(({ href, label }) => {
        // Subpáginas de edição/criação continuam pertencendo à mesma seção.
        // aria-current comunica a localização também a quem usa leitor de tela.
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={current ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-lg border px-3 py-3 text-center text-base font-bold ${current ? "border-ink bg-ink text-white" : "border-line bg-field text-ink underline underline-offset-4 hover:bg-soft"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
