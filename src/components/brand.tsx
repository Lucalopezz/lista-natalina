import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="flex items-center gap-2.5 text-lg font-bold tracking-[-0.5px] no-underline">
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14" />
      <path d="M12 7H8a2.5 2.5 0 1 1 2.5-2.5L12 7Zm0 0h4a2.5 2.5 0 1 0-2.5-2.5L12 7Z" className="text-gold" />
    </svg>
    Lista Natalina
  </Link>;
}
