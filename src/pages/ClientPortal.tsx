import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, FolderOpen, Printer, Receipt, ChevronRight, AlertCircle, FileCheck2 } from "lucide-react";
import { fmtMoney, INVOICE_STATUS_LABEL, PROJECT_TYPE_LABEL, PRINT_STATUS_LABEL, BAT_STATUS_LABEL } from "@/lib/format";

export default function ClientPortal() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bats, setBats] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("clients").select("*").maybeSingle();
      setClient(c);
      if (!c) return;
      const [p, o, i, b] = await Promise.all([
        supabase.from("projects").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
        supabase.from("print_orders").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
        supabase.from("bats").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
      ]);
      setProjects(p.data ?? []);
      setOrders(o.data ?? []);
      setInvoices(i.data ?? []);
      setBats(b.data ?? []);
    })();
  }, []);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const batToValidate = [
    ...orders.filter((o) => o.bat_file_path && !o.bat_validated_at && !o.bat_rejected_at),
    ...bats.filter((b) => b.status === "en_relecture"),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{client?.name ?? "Espace client"}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" /> Déconnexion
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {batToValidate.length > 0 && (
          <Card className="p-4 bg-amber-50 border-amber-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-900">{batToValidate.length} BAT en attente de votre validation</div>
              <div className="text-xs text-amber-700 mt-0.5">Cliquez sur une commande ci-dessous pour visualiser et valider.</div>
            </div>
          </Card>
        )}

        <Section icon={<FolderOpen className="h-4 w-4" />} title="Mes projets" count={projects.length}>
          {projects.length === 0 ? <Empty text="Aucun projet pour le moment" /> : projects.map((p) => (
            <Link key={p.id} to={`/portail/projet/${p.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/60 transition">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{PROJECT_TYPE_LABEL[p.type]}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!p.brief_submitted_at && <Badge variant="outline" className="text-[10px]">Brief à remplir</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </Section>

        <Section icon={<Printer className="h-4 w-4" />} title="Commandes impression" count={orders.length}>
          {orders.length === 0 ? <Empty text="Aucune commande" /> : orders.map((o) => (
            <Link key={o.id} to={`/portail/impression/${o.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/60 transition">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{o.description}</div>
                <div className="text-xs text-muted-foreground">{PRINT_STATUS_LABEL[o.status]}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {o.bat_file_path && !o.bat_validated_at && !o.bat_rejected_at && (
                  <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px]">BAT à valider</Badge>
                )}
                {o.bat_validated_at && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">BAT validé</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </Section>

        <Section icon={<FileCheck2 className="h-4 w-4" />} title="Bons à tirer" count={bats.length}>
          {bats.length === 0 ? <Empty text="Aucun BAT" /> : bats.map((b) => (
            <Link key={b.id} to={`/portail/bat/${b.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/60 transition">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{b.title}</div>
                <div className="text-xs text-muted-foreground">{BAT_STATUS_LABEL[b.status]}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {b.status === "en_relecture" && <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px]">À valider</Badge>}
                {b.status === "valide" && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Validé</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </Section>

        <Section icon={<Receipt className="h-4 w-4" />} title="Factures" count={invoices.length}>
          {invoices.length === 0 ? <Empty text="Aucune facture" /> : invoices.map((i) => (
            <div key={i.id} className="flex items-center justify-between p-3 rounded-lg">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{i.label}</div>
                <div className="text-xs text-muted-foreground">{INVOICE_STATUS_LABEL[i.status]}</div>
              </div>
              <div className="text-sm font-semibold">{fmtMoney(Number(i.amount))}</div>
            </div>
          ))}
        </Section>
      </main>
    </div>
  );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <Card className="divide-y">{children}</Card>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground text-center py-8">{text}</div>;
}