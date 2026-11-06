import { GiftCardFrame } from "../../gifts/components/gift-card";
import type { GroupGiftView } from "../types";
import { ReservationButton } from "./reservation-button";

export function GroupGiftCard({ gift, groupId }: { gift: GroupGiftView; groupId: string }) {
  // O DTO próprio não tem disponibilidade. Não criar indicadores, placeholders
  // ou componentes de reserva para o dono, nem serializar esses dados ao cliente.
  if (!gift.availability) return <GiftCardFrame gift={gift} />;
  return (
    <GiftCardFrame gift={gift}>
      <div className="w-full">
        <p className="mb-3 text-base font-bold">{gift.availability === "reserved" ? "Reservado neste grupo" : "Disponível neste grupo"}</p>
        {gift.availability === "available" ? <ReservationButton groupId={groupId} ownerId={gift.ownerId} giftId={gift.id} />
          : gift.canCancel ? <><p className="mb-3 text-base text-muted">Você reservou este presente.</p><ReservationButton groupId={groupId} ownerId={gift.ownerId} giftId={gift.id} cancel /></>
          : <p className="text-base text-muted">Outra pessoa deste grupo já reservou este presente.</p>}
      </div>
    </GiftCardFrame>
  );
}
