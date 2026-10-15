import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckSquare, Printer, UserPlus, CalendarDays, Users, Mail,
  Lightbulb, ClipboardList, Sparkles, Palette, Landmark, Wallet,
} from "lucide-react";

type Recap = {
  tasksOpen: number;
  tasksToday: number;
  printsToOrder: number;
  printsUnpaid: number;
  leadsNew: number;
  clients: number;
  requestsNew: number;
  rdvNext: string | null;
  rdvNextTitle: string | null;
  rdvCount: number;
  ideas: number;
  questionnaires: number;
  strategies: number;
  logoPres: number;
  cashBalance: number | null;
  debtsClients: number | null;
};

export default function Dashboard() {
  const [r, setR] = useState<Recap | null>(null);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [
        tasksOpen, tasksToday, prints, leads, clients, requests,
        appts, ideas, questionnaires, strategies, logoPres, cash, debts,
      ] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).not("status", "in", "(envoye,archive)"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "aujourdhui" as any),
        supabase.from("print_orders").select("status,payment_status").not("status", "in", "(livre,livre_paye)"),
        supabase.from("leads").select("id", { count: "exact", head: true }).is("read_at", null),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("client_requests").select("id", { count: "exact", head: true }).eq("status", "nouveau" as any),
        supabase.from("appointments").select("title,start_at").gte("start_at", new Date().toISOString()).neq("status", "annule").order("start_at", { ascending: true }).limit(5),
        supabase.from("ideas").select("id", { count: "exact", head: true }),
        supabase.from("questionnaires").select("id", { count: "exact", head: true }),
        supabase.from("brand_strategies").select("id", { count: "exact", head: true }),
        supabase.from("logo_presentations").select("id", { count: "exact", head: true }),
        supabase.from("bank_balances" as any).select("amount").order("as_of_date", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("finance_transactions").select("amount_ttc").eq("kind", "sale").is("paid_date", null),
      ]);

      const printRows = (prints.data as any) ?? [];
      const apptRows = (appts.data as any) ?? [];
      const next = apptRows[0];
      const debtRows = (debts.data as any) ?? [];

      setR({
        tasksOpen: tasksOpen.count ?? 0,
        tasksToday: tasksToday.count ?? 0,
        printsToOrder: printRows.filter((x: any) => x.status === "a_commander").length,
        printsUnpaid: printRows.filter((x: any) => x.payment_status !== "paye").length,
        leadsNew: leads.count ?? 0,
        clients: clients.count ?? 0,
        requestsNew: requests.count ?? 0,
        rdvCount: apptRows.length,
        rdvNext: next ? new Date(next.start_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) + " " + new Date(next.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null,
        rdvNextTitle: next?.title ?? null,
        ideas: ideas.count ?? 0,
        questionnaires: questionnaires.count ?? 0,
        strategies: strategies.count ?? 0,
        logoPres: logoPres.count ?? 0,
        cashBalance: (cash.data as any)?.balance ?? null,
        debtsClients: debtRows.length ? debtRows.reduce((s: number, x: any) => s + (Number(x.amount_due) || 0), 0) : null,
      });
    })();
  }, []);

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const cards = [
    { href: "/taches", icon: CheckSquare, label: "Tâches", value: r?.tasksOpen ?? "…", sub: r ? `${r.tasksToday} aujourd'hui` : "", alert: (r?.tasksToday ?? 0) > 0 },
    { href: "/impressions", icon: Printer, label: "Impressions", value: r?.printsToOrder ?? "…", sub: r ? `${r.printsUnpaid} non réglée${r.printsUnpaid > 1 ? "s" : ""}` : "", alert: (r?.printsToOrder ?? 0) > 0 },
    { href: "/demandes", icon: Mail, label: "Demandes clients", value: r?.requestsNew ?? "…", sub: "nouvelles", alert: (r?.requestsNew ?? 0) > 0 },
    { href: "/leads", icon: UserPlus, label: "Leads", value: r?.leadsNew ?? "…", sub: "non lus", alert: (r?.leadsNew ?? 0) > 0 },
    { href: "/clients", icon: Users, label: "Clients", value: r?.clients ?? "…", sub: "" },
    { href: "/rdv", icon: CalendarDays, label: "Rendez-vous", value: r?.rdvNext ?? "—", sub: r?.rdvNextTitle ?? "Aucun à venir" },
    { href: "/idees", icon: Lightbulb, label: "Idées / Notes", value: r?.ideas ?? "…", sub: "" },
    { href: "/questionnaires", icon: ClipboardList, label: "Questionnaires", value: r?.questionnaires ?? "…", sub: "" },
    { href: "/strategies", icon: Sparkles, label: "Stratégies de marque", value: r?.strategies ?? "…", sub: "" },
    { href: "/presentations-logo", icon: Palette, label: "Présentations logo", value: r?.logoPres ?? "…", sub: "" },
    { href: "/finance", icon: Wallet, label: "Trésorerie", value: r?.cashBalance != null ? eur(r.cashBalance) : "—", sub: "solde actuel" },
    { href: "/finance", icon: Landmark, label: "Dettes clients", value: r?.debtsClients != null ? eur(r.debtsClients) : "—", sub: "à encaisser", alert: (r?.debtsClients ?? 0) > 0 },
  ];

  return (
    <div className="p-4 md:p-10 w-full max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">{hello} 👋</h1>
        <p className="text-muted-foreground mt-2">Voici le récap de tes rubriques.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.href} className="rounded-xl border bg-card p-4 hover:bg-secondary/50 transition">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <c.icon className="h-3.5 w-3.5" />
              <span className="truncate">{c.label}</span>
              {c.alert && <span className="ml-auto h-2 w-2 rounded-full bg-destructive shrink-0" />}
            </div>
            <div className="text-2xl font-semibold mt-2 tabular-nums truncate">{c.value}</div>
            {c.sub && <div className="text-xs text-muted-foreground truncate mt-0.5">{c.sub}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
