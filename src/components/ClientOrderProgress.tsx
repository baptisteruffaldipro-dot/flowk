import { CalendarClock, Check, Clock3 } from "lucide-react";

export interface OrderProgressEvent { label: string; at?: string; detail?: string }
const progressLabels = (impression: boolean) => ["Maquette", "BAT", "Récapitulatif & règlement", impression ? "Impression" : "Téléchargement du fichier"];
const validDate = (value?: string) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : null;
const longDate = (value: Date) => value.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (value: Date) => value.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

const card = "rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8";
const eyebrow = "text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground";

interface Props {
  step: number;
  events: OrderProgressEvent[];
  deadline?: string;
  completed?: boolean;
  detail?: string;
  impression?: boolean;
}

function Row({ icon, title, sub, right, rightStrong, last }: { icon: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; rightStrong?: boolean; last?: boolean }) {
  return <li className="relative flex items-start gap-4 pb-6 last:pb-0">
    {!last && <span aria-hidden className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />}
    {icon}
    <div className="min-w-0 flex-1 pt-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="break-words font-semibold">{title}</span>
        {right && <span className={`shrink-0 text-sm ${rightStrong ? "font-semibold" : "text-muted-foreground"}`}>{right}</span>}
      </div>
      {sub && <p className="mt-1 break-words text-sm text-muted-foreground">{sub}</p>}
    </div>
  </li>;
}

const dot = (cls: string, child: React.ReactNode) => <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cls}`}>{child}</span>;

export function ClientOrderHistory({ step, events, deadline, completed = false, detail, impression = false }: Props) {
  const labels = progressLabels(impression);
  const current = Math.max(0, Math.min(3, step));
  const date = validDate(deadline);
  const groups = new Map<string, OrderProgressEvent[]>();
  const sorted = [...events].sort((a, b) => (validDate(b.at)?.getTime() ?? 0) - (validDate(a.at)?.getTime() ?? 0));
  const today = new Date().toDateString();
  sorted.forEach(event => {
    const at = validDate(event.at);
    const key = at ? (at.toDateString() === today ? "Aujourd'hui" : longDate(at)) : "Événements enregistrés";
    groups.set(key, [...(groups.get(key) ?? []), event]);
  });
  const upcoming = !completed ? 1 + (date && current < 3 ? 1 : 0) : 0;
  return <section aria-label="Historique de la commande" className={`${card} min-w-0 space-y-7`}>
    <h2 className={eyebrow}>Historique</h2>
    {!completed && <div className="space-y-4">
      <h3 className="flex justify-between gap-3 text-sm font-semibold"><span>En ce moment et à venir</span><span className="font-normal text-muted-foreground">{upcoming} étape{upcoming > 1 ? "s" : ""}</span></h3>
      <ol>
        <Row icon={dot("border-2 border-foreground bg-card", <Clock3 className="h-5 w-5" />)} title={labels[current]} sub={detail ?? (date ? `Prévu le ${longDate(date)}` : undefined)} right="en cours" rightStrong last={!(date && current < 3)} />
        {date && current < 3 && <Row icon={dot("border border-dashed border-border bg-card text-muted-foreground", <CalendarClock className="h-4 w-4" />)} title="Livraison prévue" sub={longDate(date)} right={shortDate(date)} last />}
      </ol>
    </div>}
    {[...groups.entries()].map(([group, items]) => <div key={group} className="space-y-4">
      <h3 className="flex justify-between gap-3 text-sm font-semibold"><span className="first-letter:uppercase">{group}</span><span className="shrink-0 font-normal text-muted-foreground">{items.length} étape{items.length > 1 ? "s" : ""}</span></h3>
      <ol>{items.map((event, i) => {
        const at = validDate(event.at);
        return <Row key={`${event.label}-${i}`} icon={dot("bg-primary/15 text-primary", <Check className="h-4 w-4" />)} title={event.label} sub={event.detail} right={at?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} last={i === items.length - 1} />;
      })}</ol>
    </div>)}
  </section>;
}

export default function ClientOrderProgress({ step, events, deadline, completed = false, detail, impression = false }: Props) {
  const labels = progressLabels(impression);
  const current = Math.max(0, Math.min(3, step));
  const date = validDate(deadline);
  return <div className="space-y-6">
    <section aria-label="Avancement" className={`${card} space-y-7`}>
      <h2 className={eyebrow}>Avancement</h2>
      <ol className="grid grid-cols-4 gap-2" aria-label="Avancement de la commande">{labels.map((label, i) => {
        const done = i < current || completed;
        const active = i === current && !completed;
        return <li key={label} aria-current={active ? "step" : undefined} className="relative min-w-0 text-center">
          {i < 3 && <div className={`absolute left-1/2 top-5 h-0.5 w-full ${i < current || completed ? "bg-primary/60" : "bg-border"}`} />}
          <div className={`relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${done || active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} ${active ? "ring-[6px] ring-primary/15" : ""}`}>{done ? <Check className="h-4 w-4" /> : i + 1}</div>
          <span className={`mt-3 block break-words text-xs sm:text-sm ${i > current && !completed ? "text-muted-foreground" : "font-semibold"}`}>{label}</span>
        </li>;
      })}</ol>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">{completed ? <Check className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{completed ? "Terminé" : "En cours"} · Étape {current + 1} sur 4</p>
            <p className="text-lg font-semibold">{completed ? impression ? "Commande livrée" : "Fichiers disponibles" : labels[current]}</p>
            {current === 2 && !completed && <p className="text-sm text-muted-foreground">{impression ? "Prestation et/ou impression" : "Prestation"}</p>}
            {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
          </div>
        </div>
        {date && !completed && <div className="sm:text-right"><p className="text-sm text-muted-foreground">Prévu le</p><time dateTime={deadline} className="font-semibold">{longDate(date)}</time></div>}
      </div>
    </section>
    {events.length > 0 && <ClientOrderHistory step={current} events={events} deadline={deadline} completed={completed} detail={detail} impression={impression} />}
  </div>;
}
