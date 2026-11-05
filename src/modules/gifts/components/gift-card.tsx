import Link from "next/link";
import type { GiftView } from "../types";
import { GiftImage } from "./gift-image";
import { DeleteGiftButton } from "./delete-gift-button";

export function GiftCard({ gift }: { gift: GiftView }) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-field">
      <GiftImage key={gift.imageUrl} src={gift.imageUrl} name={gift.name} />
      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-display text-2xl leading-tight wrap-anywhere">{gift.name}</h2>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted wrap-anywhere">{gift.description}</p>
        <a href={gift.productUrl} target="_blank" rel="noopener noreferrer" className="mt-4 py-3 text-sm font-bold text-accent underline underline-offset-4">Ver produto <span aria-hidden="true">↗</span></a>
        <div className="mt-auto flex items-center gap-4 border-t border-line pt-2">
          <Link href={`/presentes/${gift.id}/editar`} className="min-h-12 py-3 text-sm underline underline-offset-4">Editar</Link>
          <DeleteGiftButton id={gift.id} name={gift.name} />
        </div>
      </div>
    </article>
  );
}
