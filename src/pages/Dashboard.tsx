import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { CheckSquare, Printer, Mail, StickyNote, ArrowUpRight } from "lucide-react";

type Ball = "moi" | "client" | "imprimeur";
type Row = { id: string; title: string; client: string | null; status: string; deadline: string | null; updated_at: string; ball: Ball; where: string; category: string };

const STATUS_LABEL: Record<string, string> = {
  a_faire: "À faire", en_cours: "En cours", aujourdhui: "Aujourd'hui", fait: "Fait",
  bat: "BAT client · en attente", impression: "Impression en cours", a_facturer: "À facturer",
};

const daysSince = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"tout" | Ball>("tout");
  const [k, setK] = useState({ today: 0, late: 0, printsToOrder: 0, leads: 0, requests: 0, cash: null as number | null, debts: 0, rdv: null as string | null });
  const [activity, setActivity] = useState<{ id: string; kind: string; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [tasks, prints, leads, requests, cash, debts, appts, events] = await Promise.all([
        supabase.from("tasks").select("id,title,status,deadline,updated_at,scheduled_date,prestation,prestations,clients(name)").not("status", "in", "(envoye,archive)").order("updated_at", { ascending: false }).limit(200),
        supabase.from("print_orders").select("status").eq("status", "a_commander" as any),
        supabase.from("leads").select("id", { count: "exact", head: true }).is("read_at", null),
        supabase.from("client_requests").select("id", { count: "exact", head: true }).eq("status", "nouveau" as any),
        supabase.from("bank_balances" as any).select("amount").order("as_of_date", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("finance_transactions").select("amount_ttc").eq("kind", "sale").is("paid_date", null),
        supabase.from("appointments").select("title,start_at").gte("start_at", new Date().toISOString()).neq("status", "annule").order("start_at").limit(1),
        supabase.from("client_portal_events").select("id,kind,created_at").order("created_at", { ascending: false }).limit(6),
      ]);
      const list: Row[] = ((tasks.data as any[]) ?? []).map((t) => {
        const ball: Ball = t.status === "bat" ? "client" : t.status === "impression" ? "imprimeur" : "moi";
        let where = STATUS_LABEL[t.status] ?? t.status;
        if (ball !== "moi") where += ` · depuis ${daysSince(t.updated_at)} j`;
        return { id: t.id, title: t.title, client: t.clients?.name ?? null, status: t.status, deadline: t.deadline, updated_at: t.updated_at, ball, where, category: taskCategory(t) };
      }).filter((t) => t.status === "aujourdhui" || t.category === "creation");
      const late = list.filter((t) => t.deadline && t.deadline < today).length;
      const todayCount = list.filter((t) => t.status === "aujourdhui").length;
      // Prioritise: late, today, then waiting on someone
      const rank = (t: Row) => (t.deadline && t.deadline < today ? 0 : t.status === "aujourdhui" ? 1 : t.ball !== "moi" ? 2 : t.status === "en_cours" ? 3 : 4);
      list.sort((a, b) => rank(a) - rank(b));
      setRows(list);
      const a = (appts.data as any[])?.[0];
      setK({
        today: todayCount, late,
        printsToOrder: (prints.data as any[])?.length ?? 0,
        leads: leads.count ?? 0, requests: requests.count ?? 0,
        cash: (cash.data as any)?.amount ?? null,
        debts: ((debts.data as any[]) ?? []).reduce((s, x) => s + (Number(x.amount_ttc) || 0), 0),
        rdv: a ? new Date(a.start_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " · " + a.title : null,
      });
      setActivity((events.data as any[]) ?? []);
    })();
  }, []);

  const counts = useMemo(() => ({
    tout: rows?.length ?? 0,
    moi: rows?.filter((r) => r.ball === "moi").length ?? 0,
    client: rows?.filter((r) => r.ball === "client").length ?? 0,
    imprimeur: rows?.filter((r) => r.ball === "imprimeur").length ?? 0,
  }), [rows]);
  const visible = (rows ?? []).filter((r) => filter === "tout" || r.ball === filter).slice(0, 12);

  const now = new Date();
  const week = Math.ceil(((+now - +new Date(now.getFullYear(), 0, 1)) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const hello = now.getHours() < 18 ? "Bonjour" : "Bonsoir";
  const today = now.toISOString().slice(0, 10);

  const kpis = [
    { label: "Aujourd'hui", value: k.today, sub: "tâches prévues", dot: true },
    { label: "En attente du client", value: counts.client, sub: "BAT envoyés non validés" },
    { label: "En retard", value: k.late, sub: "échéance dépassée", alert: k.late > 0 },
    { label: "Impressions à commander", value: k.printsToOrder, sub: "à passer chez l'imprimeur", alert: k.printsToOrder > 0 },
  ];

  const quick = [
    { to: "/taches", icon: CheckSquare, label: "Nouvelle tâche", sub: "Créer une prestation" },
    { to: "/demandes", icon: Mail, label: "Demande client", sub: "Envoyer par email" },
    { to: "/impressions", icon: Printer, label: "Commande d'impression", sub: "Tarifs par quantité" },
    { to: "/notes", icon: StickyNote, label: "Note / idée", sub: "Noter rapidement" },
  ];

  const recap = [
    { to: "/leads", label: "Nouveaux leads", value: String(k.leads), alert: k.leads > 0 },
    { to: "/demandes", label: "Demandes clients", value: String(k.requests), alert: k.requests > 0 },
    { to: "/rdv", label: "Prochain RDV", value: k.rdv ?? "—" },
    { to: "/finance/tresorerie", label: "Trésorerie", value: k.cash != null ? eur(k.cash) : "—" },
    { to: "/finance/transactions", label: "Dettes clients", value: eur(k.debts), alert: k.debts > 0 },
  ];

  const ballChip = (b: Ball) => (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs">
      <span className={cn("h-1.5 w-1.5 rounded-full", b === "client" ? "bg-accent" : b === "imprimeur" ? "bg-info" : "bg-foreground")} />
      {b === "moi" ? "Moi" : b === "client" ? "Client" : "Imprimeur"}
    </span>
  );

  const eventLabel = (kind: string) => ({
    approve_file: "BAT signé par le client", approve: "Validation client", request_changes: "Retour client sur un BAT",
    payment_link_requested: "Lien de paiement demandé", viewed: "Portail consulté", message: "Nouveau message client",
  } as Record<string, string>)[kind] ?? kind.replace(/_/g, " ");

  return (
    <div className="p-4 md:p-8 w-full max-w-[1500px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{hello} Baptiste</h1>
        <p className="text-muted-foreground mt-1 first-letter:uppercase">
          {dateLabel} · semaine {week} · {k.today} tâche{k.today > 1 ? "s" : ""} aujourd'hui{k.late ? `, ${k.late} en retard` : ", aucun retard"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl border bg-card overflow-hidden mb-6">
        {kpis.map((x, i) => (
          <div key={x.label} className={cn("p-5", i > 0 && "border-l", i >= 2 && "border-t lg:border-t-0", i === 2 && "border-l-0 lg:border-l")}>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {x.dot && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}{x.label}
            </div>
            <div className={cn("text-3xl font-semibold mt-1 tabular-nums", x.alert && "text-destructive")}>{x.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{x.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <section className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b">
            <h2 className="font-semibold text-lg">À faire maintenant</h2>
            <div className="ml-auto flex gap-1 rounded-full bg-secondary p-1 text-xs">
              {(["tout", "moi", "client", "imprimeur"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1 rounded-full capitalize", filter === f ? "bg-card shadow-sm font-medium" : "text-muted-foreground")}>
                  {f === "tout" ? "Tout" : f === "moi" ? "Moi" : f} · {counts[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden md:grid grid-cols-[1.6fr_1fr_120px_1.4fr_80px] gap-3 px-5 py-2.5 text-xs text-muted-foreground border-b">
            <div>Tâche</div><div>Client</div><div>La balle est chez</div><div>Où en est-on</div><div className="text-right">Action</div>
          </div>
          {rows === null && <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>}
          {rows && visible.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Rien à traiter pour l'instant.</div>}
          {visible.map((r) => {
            const late = r.deadline && r.deadline < today;
            return (
              <Link key={r.id} to={`/taches/${r.id}`} className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_120px_1.4fr_80px] gap-1 md:gap-3 px-5 py-3 border-b last:border-b-0 items-center hover:bg-secondary/50 text-sm">
                <div className="font-medium truncate">{r.title}</div>
                <div className="text-muted-foreground truncate">{r.client ?? "—"}</div>
                <div>{ballChip(r.ball)}</div>
                <div className={cn("text-muted-foreground truncate", late && "text-destructive")}>
                  {late ? `En retard · ${new Date(r.deadline!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : r.where}
                </div>
                <div className="md:text-right"><span className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs bg-card">Ouvrir <ArrowUpRight className="h-3 w-3" /></span></div>
              </Link>
            );
          })}
          {rows && rows.length > visible.length && filter === "tout" && (
            <Link to="/taches" className="block px-5 py-3 text-sm text-muted-foreground hover:text-foreground border-t">Voir les {rows.length} tâches →</Link>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card">
            <h2 className="font-semibold px-5 py-4 border-b">Pour aller plus vite</h2>
            <div className="grid grid-cols-2 gap-3 p-4">
              {quick.map((q) => (
                <Link key={q.label} to={q.to} className="rounded-xl border p-3 hover:bg-secondary/50">
                  <div className="h-8 w-8 rounded-lg bg-accent/20 grid place-items-center mb-3"><q.icon className="h-4 w-4" /></div>
                  <div className="text-sm font-medium leading-tight">{q.label}</div>
                  <div className="text-xs text-muted-foreground">{q.sub}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card">
            <h2 className="font-semibold px-5 py-4 border-b">Récap</h2>
            {recap.map((x) => (
              <Link key={x.label} to={x.to} className="flex items-center gap-3 px-5 py-2.5 border-b last:border-b-0 text-sm hover:bg-secondary/50">
                <span className="text-muted-foreground">{x.label}</span>
                {x.alert && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                <span className="ml-auto font-medium truncate max-w-[55%] text-right tabular-nums">{x.value}</span>
              </Link>
            ))}
          </section>

          <section className="rounded-2xl border bg-card">
            <h2 className="font-semibold px-5 py-4 border-b">Activité récente</h2>
            {activity.length === 0 && <div className="px-5 py-4 text-sm text-muted-foreground">Aucune activité client.</div>}
            {activity.map((e) => (
              <div key={e.id} className="flex gap-3 px-5 py-2.5 text-sm">
                <span className="h-2 w-2 rounded-full bg-success mt-1.5 shrink-0" />
                <div>
                  <div>{eventLabel(e.kind)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
