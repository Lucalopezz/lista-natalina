import Link from "next/link";
export default function GroupNotFound() {
  return <section className="py-12"><h1 className="text-3xl font-bold">Grupo não encontrado.</h1><p className="mt-4 text-base text-muted">Não foi possível abrir este grupo para sua conta.</p><Link href="/grupos" className="mt-4 inline-block py-3 text-base text-accent underline underline-offset-4">Voltar aos meus grupos</Link></section>;
}
