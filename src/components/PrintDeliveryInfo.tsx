import { format, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, MapPin } from "lucide-react";

export type PrintDeliveryDetails = { estimated_delivery_date?: string | null; delivery_location?: string | null };

export default function PrintDeliveryInfo({ order }: { order: PrintDeliveryDetails }) {
  const date = order.estimated_delivery_date ? parseISO(order.estimated_delivery_date) : null;
  const location = order.delivery_location?.trim();
  if ((!date || !isValid(date)) && !location) return null;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/60 pt-3 text-sm">
      {date && isValid(date) && <div className="min-w-0"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><CalendarDays className="h-3.5 w-3.5" />Livraison estimée</dt><dd>{format(date, "d MMMM yyyy", { locale: fr })}</dd></div>}
      {location && <div className="min-w-0"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><MapPin className="h-3.5 w-3.5" />Lieu de livraison</dt><dd className="whitespace-pre-wrap break-words">{location}</dd></div>}
    </dl>
  );
}