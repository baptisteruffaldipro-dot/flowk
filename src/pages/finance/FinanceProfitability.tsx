import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";

type Row = { id: string; name: string; revenue: number; cost: number; margin: number; pct: number };

function pctColor(pct: number) {
  if (pct >= 40) return "text-emerald-600";
  if (pct >= 15) return "text-amber-600";
  return "text-rose-600";
}

function Table({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b bg-muted/40">
          <tr>
            <th className="text-left px-3 py-2">{label}</th>
            <th className="text-right px-3 py-2">CA HT</th>
            <th className="text-right px-3 py-2">Coûts HT</th>
            <th className="text-right px-3 py-2">Marge</th>
            <th className="text-right px-3 py-2">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.revenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(r.cost)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(r.margin)}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${pctColor(r.pct)}`}>{r.pct.toFixed(1)}%</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune donnée</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

export default function FinanceProfitability() {
  const [tx, setTx] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const [t, c, p, k] = await Promise.all([
      supabase.from("finance_transactions").select("kind, amount_ht, supplier_cost_ht, client_id, project_id, task_id"),
      supabase.from("clients").select("id, name"),
      supabase.from("projects").select("id, name"),
      supabase.from("tasks").select("id, title"),
    ]);
    setTx(t.data ?? []); setClients(c.data ?? []); setProjects(p.data ?? []); setTasks(k.data ?? []);
  })(); }, []);

  const agg = (key: "client_id" | "project_id" | "task_id", labels: Map<string, string>) => {
    const map = new Map<string, Row>();
    for (const r of tx) {
      const id = r[key]; if (!id) continue;
      if (!map.has(id)) map.set(id, { id, name: labels.get(id) ?? id, revenue: 0, cost: 0, margin: 0, pct: 0 });
      const row = map.get(id)!;
      if (r.kind === "sale") { row.revenue += Number(r.amount_ht || 0); row.cost += Number(r.supplier_cost_ht || 0); }
      else if (r.kind === "expense") { row.cost += Number(r.amount_ht || 0); }
    }
    const arr = Array.from(map.values());
    arr.forEach((r) => { r.margin = r.revenue - r.cost; r.pct = r.revenue > 0 ? (r.margin / r.revenue) * 100 : 0; });
    return arr.sort((a, b) => b.revenue - a.revenue);
  };

  const byClient = useMemo(() => agg("client_id", new Map(clients.map((c) => [c.id, c.name]))), [tx, clients]);
  const byProject = useMemo(() => agg("project_id", new Map(projects.map((p) => [p.id, p.name]))), [tx, projects]);
  const byTask = useMemo(() => agg("task_id", new Map(tasks.map((t) => [t.id, t.title]))), [tx, tasks]);

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Rentabilité" description="Marge par client, projet ou tâche. Lie tes dépenses via les règles pour affiner." />
      <FinanceNav />
      <Tabs defaultValue="client">
        <TabsList>
          <TabsTrigger value="client">Par client</TabsTrigger>
          <TabsTrigger value="project">Par projet</TabsTrigger>
          <TabsTrigger value="task">Par tâche</TabsTrigger>
        </TabsList>
        <TabsContent value="client" className="mt-4"><Table rows={byClient} label="Client" /></TabsContent>
        <TabsContent value="project" className="mt-4"><Table rows={byProject} label="Projet" /></TabsContent>
        <TabsContent value="task" className="mt-4"><Table rows={byTask} label="Tâche" /></TabsContent>
      </Tabs>
    </div>
  );
}