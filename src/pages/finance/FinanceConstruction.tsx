import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  HardHat, CalendarPlus, ArrowRight, Wallet, Receipt, ListChecks,
  Layers, Upload, Check, CircleDashed,
} from "lucide-react";

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const TODO = [
  { t: "Les pôles", d: "Graphisme, Platorama, Côté Souvenir, Royan Impression — et comment une dépense se répartit entre eux." },
  { t: "Les labels", d: "Marquer chaque transaction en une seconde, avec le label « Général » pour ce qui est commun." },
  { t: "La TVA", d: "Ce que tu dois vraiment le mois prochain, pas une estimation théorique." },
  { t: "La trésorerie", d: "Ce qu'il reste une fois le prêt et ton apport en compte courant remboursés." },
  { t: "Les dettes clients", d: "Qui te doit quoi, et quand ça devrait rentrer." },
];

export default function FinanceConstruction() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ tx: number; cash: number | null; debts: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const [tx, bank, debts] = await Promise.all([
        supabase.from("finance_transactions").select("id", { count: "exact", head: true }),
        supabase
          .from("bank_balances")
          .select("amount")
          .lte("as_of_date", now.toISOString().slice(0, 10))
          .order("as_of_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("finance_transactions").select("id", { count: "exact", head: true }).eq("kind", "sale").is("paid_date", null),
      ]);
      setStats({
        tx: tx.count ?? 0,
        cash: bank.data?.[0]?.amount ?? null,
        debts: debts.count ?? 0,
      });
    };
    load();
  }, []);

  const bookPoint = async () => {
    setBusy(true);
    const start = new Date();
    start.setDate(start.getDate() + 3);
    start.setHours(9, 0, 0, 0);
    const { error } = await supabase.from("appointments").insert({
      title: "Point Finance",
      start_at: start.toISOString(),
      duration_minutes: 60,
      type: "presentiel",
      status: "planifie",
      client_id: null,
      project_id: null,
      location: null,
      notes: "Reprendre le module Finance ensemble : pôles, labels, TVA, trésorerie, dettes clients.",
      reminder_minutes_before: null,
      reminder_sent_at: null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Point Finance ajouté à ton agenda");
    navigate("/rdv");
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-[1100px] mx-auto">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Finance</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-xs font-medium">
          <HardHat className="h-3.5 w-3.5" /> En construction
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ce module est mis en pause volontaire. Il fonctionne, mais il ne ressemble pas encore à ta façon
            de travailler. On le reprendra ensemble, calmement, pour qu'il réponde à trois questions simples :
            <span className="text-foreground font-medium"> combien tu rentres, ce que tu dois, et ce qu'il te reste.</span>
          </p>

          <h2 className="font-semibold mt-7 mb-3">Ce qu'on doit décider ensemble</h2>
          <ul className="space-y-3">
            {TODO.map((x) => (
              <li key={x.t} className="flex gap-3">
                <CircleDashed className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium leading-tight">{x.t}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{x.d}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-3 border-t pt-5">
            <Button onClick={bookPoint} disabled={busy} className="gap-2 rounded-full">
              <CalendarPlus className="h-4 w-4" /> {busy ? "Ajout en cours…" : "Planifier un point"}
            </Button>
            <span className="text-xs text-muted-foreground">Ajoute un « Point Finance » de 1 h dans ton agenda, à J+3 à 9 h.</span>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card">
            <h2 className="font-semibold px-5 py-4 border-b text-sm">Tes données sont là</h2>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-accent/20 grid place-items-center shrink-0"><Receipt className="h-4 w-4" /></span>
                <div>
                  <div className="font-medium tabular-nums">{stats ? `${stats.tx} écritures` : "…"}</div>
                  <div className="text-xs text-muted-foreground">issues de Tiime</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-accent/20 grid place-items-center shrink-0"><Wallet className="h-4 w-4" /></span>
                <div>
                  <div className="font-medium tabular-nums">{stats ? (stats.cash != null ? eur(stats.cash) : "—") : "…"}</div>
                  <div className="text-xs text-muted-foreground">solde bancaire actuel</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-accent/20 grid place-items-center shrink-0"><Check className="h-4 w-4" /></span>
                <div>
                  <div className="font-medium tabular-nums">{stats ? `${stats.debts} facture${stats.debts > 1 ? "s" : ""}` : "…"}</div>
                  <div className="text-xs text-muted-foreground">en attente de règlement</div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card">
            <h2 className="font-semibold px-5 py-4 border-b text-sm">Écrans encore accessibles</h2>
            {[
              { to: "/finance/transactions", label: "Transactions", icon: ListChecks },
              { to: "/finance/poles", label: "Pôles", icon: Layers },
              { to: "/finance/tresorerie", label: "TVA & Trésorerie", icon: Wallet },
              { to: "/finance/import", label: "Import Tiime", icon: Upload },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-2.5 px-5 py-2.5 border-b last:border-b-0 text-sm hover:bg-secondary/50">
                <l.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{l.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
