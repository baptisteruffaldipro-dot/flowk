import { CalendarClock, Check, Clock3 } from "lucide-react";

export interface OrderProgressEvent { label: string; at?: string; detail?: string }
const progressLabels = (impression: boolean) => ["Maquette", "BAT", "Récapitulatif & règlement", impression ? "Impression" : "Téléchargement du fichier"];
const validDate = (value?: string) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : null;
const longDate = (value: Date) => value.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

interface Props {
  step: number;
  events: OrderProgressEvent[];
  deadline?: string;
  completed?: boolean;
  detail?: string;
  impression?: boolean;
}

export function ClientOrderHistory({ step, events, deadline, completed = false, detail, impression = false }: Props) {
  const labels = progressLabels(impression);
  const current = Math.max(0, Math.min(3, step));
  const date = validDate(deadline);
  const groups = new Map<string, OrderProgressEvent[]>();
  const sorted = [...events].sort((a, b) => (validDate(b.at)?.getTime() ?? 0) - (validDate(a.at)?.getTime() ?? 0));
  sorted.forEach(event => {
    const at = validDate(event.at);
    const key = at ? longDate(at) : "Événements enregistrés";
    groups.set(key, [...(groups.get(key) ?? []), event]);
  });
  return <section aria-label="Historique de la commande" className="min-w-0 space-y-5 border-b border-border py-6">
    <h2 className="text-xs font-semibold uppercase text-muted-foreground">Historique</h2>
    {!completed && <div className="space-y-4">
      <h3 className="text-sm font-semibold">En ce moment et à venir</h3>
      <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 text-primary"><Clock3 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{labels[current]}</strong><span className="text-xs text-muted-foreground">en cours</span></div>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div></div>
      {date && current < 3 && <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"><CalendarClock className="h-4 w-4" /></span><div><p className="text-sm font-semibold">Livraison prévue</p><time dateTime={deadline} className="text-xs text-muted-foreground">{longDate(date)}</time></div></div>}
    </div>}
    {[...groups.entries()].map(([group, items]) => <div key={group} className="space-y-4"><h3 className="flex justify-between gap-3 text-sm font-semibold"><span className="capitalize">{group}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{items.length} événement{items.length > 1 ? "s" : ""}</span></h3><ol className="space-y-4">{items.map((event, i) => <li key={`${event.label}-${i}`} className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"><Check className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="break-words font-medium">{event.label}</span>{validDate(event.at) && <time dateTime={event.at} className="shrink-0 text-xs text-muted-foreground">{validDate(event.at)?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>}</div>{event.detail && <p className="mt-1 break-words text-xs text-muted-foreground">{event.detail}</p>}</div></li>)}</ol></div>)}
  </section>;
}

export default function ClientOrderProgress({ step, events, deadline, completed = false, detail, impression = false }: Props) {
  const labels = progressLabels(impression);
  const current = Math.max(0, Math.min(3, step));
  const date = validDate(deadline);
  return <section aria-label="Avancement" className="space-y-6 border-y border-border py-6">
    <h2 className="text-xs font-semibold uppercase text-muted-foreground">Avancement</h2>
    <ol className="grid grid-cols-4 gap-2" aria-label="Avancement de la commande">{labels.map((label, i) => <li key={label} aria-current={!completed && current === i ? "step" : undefined} className="relative min-w-0 text-center"><div className={`relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${i <= current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"} ${i === current && !completed ? "ring-4 ring-primary/15" : ""}`}>{i < current || completed ? <Check className="h-4 w-4" /> : i + 1}</div>{i < 3 && <div className={`absolute left-1/2 top-4 h-px w-full ${i < current ? "bg-primary" : "bg-border"}`} />}<span className={`relative mt-3 block break-words text-xs sm:text-sm ${i > current ? "text-muted-foreground" : "font-medium"}`}>{label}</span></li>)}</ol>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-primary/20 bg-primary/5 p-4"><div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{completed ? <Check className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase text-muted-foreground">{completed ? "Terminé" : "En cours"} · Étape {current + 1} sur 4</p><p className="font-semibold">{completed ? impression ? "Commande livrée" : "Fichiers disponibles" : labels[current]}</p>{current === 2 && <p className="mt-1 text-xs text-muted-foreground">{impression ? "Prestation et/ou impression" : "Prestation"}</p>}{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div></div>{date && !completed && <div className="text-sm sm:text-right"><p className="text-xs text-muted-foreground">Livraison prévue le</p><time dateTime={deadline} className="font-semibold">{longDate(date)}</time></div>}</div>
    {events.length > 0 && <ClientOrderHistory step={current} events={events} deadline={deadline} completed={completed} detail={detail} impression={impression} />}
  </section>;
}