import Link from "next/link";
export default function GroupNotFound() {
  return <section className="py-12"><h1 className="font-display text-3xl">Grupo não encontrado.</h1><p className="mt-4 text-sm text-muted">Não foi possível abrir este grupo para sua conta.</p><Link href="/grupos" className="mt-4 inline-block py-3 text-sm text-accent underline underline-offset-4">Voltar aos meus grupos</Link></section>;
}
