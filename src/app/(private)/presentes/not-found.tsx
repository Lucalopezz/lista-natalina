import Link from "next/link";
export default function GiftNotFound() {
  return <section className="py-12"><h1 className="font-display text-3xl">Presente não encontrado.</h1><p className="mt-4 text-muted">Não foi possível abrir este presente na sua lista.</p><Link href="/presentes" className="mt-4 inline-block py-3 text-accent underline underline-offset-4">Voltar à minha lista</Link></section>;
}
