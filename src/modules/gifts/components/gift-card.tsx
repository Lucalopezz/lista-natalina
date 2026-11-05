import Link from "next/link";
import type { GiftView } from "../types";
import { GiftImage } from "./gift-image";
import { DeleteGiftButton } from "./delete-gift-button";

export function GiftCard({ gift }: { gift: GiftView }) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-field">
      <GiftImage key={gift.imageUrl} src={gift.imageUrl} name={gift.name} />
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-2xl leading-tight font-bold wrap-anywhere">{gift.name}</h2>
        <p className="mt-3 text-base leading-relaxed whitespace-pre-line text-muted wrap-anywhere">{gift.description}</p>
        <a href={gift.productUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex min-h-12 items-center justify-center rounded-lg border border-ink px-4 py-3 text-base font-bold underline underline-offset-4">Ver na loja <span className="ml-2" aria-hidden="true">↗</span></a>
        <p className="mt-2 mb-4 text-base text-muted">Abre o site da loja em outra aba.</p>
        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Link href={`/presentes/${gift.id}/editar`} className="min-h-12 rounded-lg border border-line px-5 py-3 text-base underline underline-offset-4">Editar</Link>
          <DeleteGiftButton id={gift.id} name={gift.name} />
        </div>
      </div>
    </article>
  );
}
