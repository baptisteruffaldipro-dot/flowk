import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, STATUS_LABEL, PRINT_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/lib/format";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase as sb } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState as useStateLocal } from "react";

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [inviting, setInviting] = useStateLocal(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [c, p, t, o, i] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).maybeSingle(),
        supabase.from("projects").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("print_orders").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("invoices").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      ]);
      setClient(c.data);
      setProjects(p.data ?? []);
      setTasks(t.data ?? []);
      setOrders(o.data ?? []);
      setInvoices(i.data ?? []);
    })();
  }, [id]);

  if (!client) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const invite = async () => {
    if (!client.email) return toast.error("Ajoutez d'abord un email au client");
    setInviting(true);
    const { data, error } = await sb.functions.invoke("invite-client", { body: { client_id: client.id } });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Échec de l'invitation");
      return;
    }
    toast.success("Invitation envoyée par email");
    const { data: c } = await sb.from("clients").select("*").eq("id", client.id).maybeSingle();
    setClient(c);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <Link to="/clients" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Clients
      </Link>
      <PageHeader
        title={client.name}
        description={client.company ?? undefined}
        actions={
          client.portal_user_id ? (
            <span className="text-xs inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Portail activé
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={invite} disabled={inviting || !client.email}>
              <Mail className="h-4 w-4 mr-1" /> {inviting ? "Envoi…" : "Inviter au portail"}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <InfoCard label="Email" value={client.email ?? "—"} />
        <InfoCard label="Téléphone" value={client.phone ?? "—"} />
        <InfoCard label="Adresse" value={client.address ?? "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Projets ({projects.length})</h2>
          <div className="space-y-1">
            {projects.length === 0 ? <Empty text="Aucun projet" /> : projects.map((p) => (
              <Link key={p.id} to={`/projets/${p.id}`} className="block p-2.5 rounded hover:bg-secondary/60 text-sm">
                {p.name}
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Tâches récentes</h2>
          <div className="space-y-1">
            {tasks.length === 0 ? <Empty text="Aucune tâche" /> : tasks.map((t) => (
              <Link key={t.id} to={`/taches/${t.id}`} className="flex items-center justify-between p-2.5 rounded hover:bg-secondary/60 text-sm">
                <span className="truncate">{t.title}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{STATUS_LABEL[t.status]}</Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Commandes impression</h2>
          <div className="space-y-1">
            {orders.length === 0 ? <Empty text="Aucune commande" /> : orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-2.5 rounded hover:bg-secondary/60 text-sm">
                <span className="truncate">{o.description}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{PRINT_STATUS_LABEL[o.status]}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Factures</h2>
          <div className="space-y-1">
            {invoices.length === 0 ? <Empty text="Aucune facture" /> : invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-2.5 rounded hover:bg-secondary/60 text-sm">
                <span className="truncate">{i.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium">{fmtMoney(Number(i.amount))}</span>
                  <Badge variant="outline" className="text-[10px]">{INVOICE_STATUS_LABEL[i.status]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm mt-1">{value}</div>
    </Card>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground py-6 text-center">{text}</div>;
}