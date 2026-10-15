import { Check, Clock3, LockKeyhole } from "lucide-react";

interface Event { label: string; at?: string; detail?: string }
export default function ClientOrderProgress({ step, events, deadline }: { step: number; events: Event[]; deadline?: string }) {
  const labels = ["Maquette", "Validation du BAT", "Impression", "Livraison"];
  return (
    <section className="space-y-6 border-y border-border py-7">
      <h2 className="text-xs font-semibold uppercase text-muted-foreground">Suivi de votre commande</h2>
      <ol className="grid grid-cols-4 gap-2" aria-label="Avancement de la commande">{labels.map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined} className="relative text-center"><div className={`relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${i <= step ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"}`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</div>{i < 3 && <div className={`absolute left-1/2 top-4 h-px w-full ${i < step ? "bg-primary" : "bg-border"}`} />}<span className={`relative mt-3 block text-xs sm:text-sm ${i > step ? "text-muted-foreground" : "font-medium"}`}>{label}</span></li>)}</ol>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted p-4 rounded-md"><div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Étape {step + 1} sur 4</p><p className="font-semibold">{labels[step]}</p></div></div>{deadline && <div className="text-sm"><span className="text-xs text-muted-foreground">Livraison estimée</span><p>{new Date(deadline).toLocaleDateString("fr-FR")}</p></div>}</div>
      {events.length > 0 && <div><h3 className="mb-4 text-xs font-semibold uppercase text-muted-foreground">Historique</h3><ol className="space-y-4 border-l border-border ml-2 pl-5">{events.map((event, i) => <li key={`${event.label}-${i}`} className="relative"><span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-primary" /><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{event.label}</span>{event.at && <time className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString("fr-FR")}</time>}</div>{event.detail && <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>}</li>)}</ol></div>}
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3 w-3 shrink-0" />Lien sécurisé, personnel à votre commande.</p>
    </section>
  );
}