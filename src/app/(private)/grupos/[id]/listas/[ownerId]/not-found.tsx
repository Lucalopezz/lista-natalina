import Link from "next/link";
export default function WishlistNotFound() {
  return <section className="py-8"><h1 className="text-3xl font-bold">Lista não encontrada.</h1><p className="mt-4 leading-relaxed text-muted">Não foi possível abrir esta lista para sua conta neste grupo.</p><Link href="/grupos" className="mt-4 inline-flex min-h-12 items-center py-3 underline underline-offset-4">Voltar aos meus grupos</Link></section>;
}
