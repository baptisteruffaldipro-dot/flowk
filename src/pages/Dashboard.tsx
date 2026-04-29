import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, STATUS_LABEL, PRINT_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/lib/format";
import { ArrowRight } from "lucide-react";
import QuickCreate from "@/components/QuickCreate";

type Task = { id: string; title: string; status: string; deadline: string | null; clients?: { name: string } | null };
type Order = { id: string; description: string; status: string; clients?: { name: string } | null };
type Inv = { id: string; label: string; amount: number; status: string; clients?: { name: string } | null };

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [stats, setStats] = useState({ today: 0, pendingRevenue: 0, awaitingBat: 0 });

  const load = async () => {
      const [t, o, i] = await Promise.all([
        supabase.from("tasks").select("id,title,status,deadline,clients(name)").not("status", "in", "(envoye,archive)").order("deadline", { ascending: true, nullsFirst: false }).limit(50),
        supabase.from("print_orders").select("id,description,status,clients(name)").not("status", "in", "(livre)").order("created_at", { ascending: false }).limit(50),
        supabase.from("invoices").select("id,label,amount,status,clients(name)").neq("status", "payee").order("created_at", { ascending: false }).limit(50),
      ]);
      setTasks((t.data as any) ?? []);
      setOrders((o.data as any) ?? []);
      setInvoices((i.data as any) ?? []);

      const today = new Date().toISOString().slice(0, 10);
      const todayTasks = ((t.data as any) ?? []).filter((x: Task) => x.status === "aujourdhui" || x.deadline === today).length;
      const pendingRev = ((i.data as any) ?? []).filter((x: Inv) => x.status === "a_facturer" || x.status === "facturee").reduce((s: number, x: Inv) => s + Number(x.amount), 0);
      const awaitBat = ((o.data as any) ?? []).filter((x: Order) => x.status === "bat_en_attente").length;
      setStats({ today: todayTasks, pendingRevenue: pendingRev, awaitingBat: awaitBat });
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Dashboard" description="Vue d'ensemble de ton activité" />

      <div className="mb-6">
        <QuickCreate onCreated={load} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Tâches aujourd'hui" value={String(stats.today)} />
        <StatCard label="CA en attente" value={fmtMoney(stats.pendingRevenue)} />
        <StatCard label="BAT à valider" value={String(stats.awaitingBat)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Column title="Tâches à faire" href="/taches" empty="Aucune tâche en cours">
          {tasks.slice(0, 8).map((t) => (
            <Link key={t.id} to={`/taches/${t.id}`} className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug truncate">{t.title}</div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{STATUS_LABEL[t.status]}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">{t.clients?.name ?? "—"}</div>
            </Link>
          ))}
        </Column>

        <Column title="Impressions en cours" href="/impressions" empty="Aucune commande en cours">
          {orders.slice(0, 8).map((o) => (
            <Link key={o.id} to={`/impressions/${o.id}`} className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug truncate">{o.description}</div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{PRINT_STATUS_LABEL[o.status]}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">{o.clients?.name ?? "—"}</div>
            </Link>
          ))}
        </Column>

        <Column title="Gestion budgétaire" href="/facturation" empty="Aucune facture en attente">
          {invoices.slice(0, 8).map((i) => (
            <Link key={i.id} to="/facturation" className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug truncate">{i.label}</div>
                <div className="text-sm font-semibold shrink-0">{fmtMoney(Number(i.amount))}</div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="text-xs text-muted-foreground truncate">{i.clients?.name ?? "—"}</div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{INVOICE_STATUS_LABEL[i.status]}</Badge>
              </div>
            </Link>
          ))}
        </Column>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </Card>
  );
}

function Column({ title, href, children, empty }: { title: string; href: string; children: React.ReactNode; empty: string }) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.filter(Boolean).length === 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Link to={href} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Tout voir <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-1">
        {isEmpty ? <div className="text-sm text-muted-foreground py-8 text-center">{empty}</div> : children}
      </div>
    </Card>
  );
}