import { useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PrintDeliveryFields({ date, location, onDateChange, onLocationChange }: {
  date: string; location: string; onDateChange: (value: string) => void; onLocationChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = date ? parseISO(date) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;
  return <>
    <div className="space-y-1.5">
      <Label htmlFor="print-delivery-date" className="text-xs text-muted-foreground">Date de livraison estimée</Label>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild><Button id="print-delivery-date" variant="outline" className="w-full justify-start font-normal"><CalendarDays className="h-4 w-4 mr-2 shrink-0" />{selected ? format(selected, "d MMMM yyyy", { locale: fr }) : "Choisir une date"}</Button></PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0 pointer-events-auto"><Calendar mode="single" locale={fr} selected={selected} defaultMonth={selected} onSelect={(value) => { onDateChange(value ? format(value, "yyyy-MM-dd") : ""); setOpen(false); }} initialFocus className="pointer-events-auto" /></PopoverContent>
        </Popover>
        {date && <Button size="icon" variant="ghost" aria-label="Effacer la date de livraison" onClick={() => onDateChange("")}><X className="h-4 w-4" /></Button>}
      </div>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="print-delivery-location" className="text-xs text-muted-foreground">Lieu de livraison</Label>
      <Textarea id="print-delivery-location" rows={2} value={location} onChange={(event) => onLocationChange(event.target.value)} />
    </div>
  </>;
}