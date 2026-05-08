import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Mail, Phone, Trash2, Copy } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  qualifie: "Qualifié",
  converti: "Converti",
  perdu: "Perdu",
};

const STATUS_TONE: Record<string, string> = {
  nouveau: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  contacte: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  qualifie: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  converti: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  perdu: "bg-stone-100 text-stone-600 dark:bg-stone-900/40 dark:text-stone-400",
};

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("leads-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const markRead = async (id: string) => {
    await supabase.from("leads").update({ read_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    const lead = leads.find((l) => l.id === id);
    if (lead && !lead.read_at) patch.read_at = new Date().toISOString();
    await supabase.from("leads").update(patch).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce lead ?")) return;
    await supabase.from("leads").delete().eq("id", id);
    toast.success("Supprimé");
    load();
  };

  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-lead`;
  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpoint);
    toast.success("URL copiée");
  };

  const unread = leads.filter((l) => !l.read_at).length;

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader
        title="Leads"
        description={loading ? "Chargement…" : `${leads.length} lead(s) · ${unread} non lu(s)`}
      />

      <Card className="p-4 mb-4 bg-secondary/30">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Endpoint formulaire</div>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-background px-2 py-1.5 rounded border border-border flex-1 truncate">{endpoint}</code>
          <Button size="sm" variant="outline" onClick={copyEndpoint}><Copy className="h-3.5 w-3.5" /></Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Envoyez un POST JSON avec : <code>name</code>, <code>email</code>, <code>phone</code>, <code>company</code>, <code>message</code>, <code>source</code>.
        </p>
      </Card>

      {leads.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Aucun lead pour le moment.
        </Card>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => (
            <Card key={l.id} className={`p-4 ${!l.read_at ? "border-l-4 border-l-sky-500" : ""}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{l.name || l.company || l.email || "Sans nom"}</h3>
                    {l.company && l.name && <span className="text-xs text-muted-foreground">· {l.company}</span>}
                    <Badge className={`${STATUS_TONE[l.status]} border-0 text-[10px]`}>{STATUS_LABEL[l.status]}</Badge>
                    {!l.read_at && <Badge variant="outline" className="text-[10px] border-sky-400 text-sky-600">Nouveau</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                    {l.email && (
                      <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Mail className="h-3 w-3" /> {l.email}
                      </a>
                    )}
                    {l.phone && (
                      <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="h-3 w-3" /> {l.phone}
                      </a>
                    )}
                    <span>{fmtDateTime(l.created_at)}</span>
                    {l.source && <span>· {l.source}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!l.read_at && (
                    <Button size="sm" variant="outline" onClick={() => markRead(l.id)} className="h-8 text-xs">Marquer lu</Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => remove(l.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {l.message && (
                <div className="text-sm whitespace-pre-wrap bg-secondary/40 rounded p-3 mt-2">{l.message}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}