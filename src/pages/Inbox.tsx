import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Archive, ExternalLink, Inbox as InboxIcon } from "lucide-react";
import QuickCapture from "@/components/QuickCapture";
import { fmtDateTime } from "@/lib/format";

const SOURCE_LABEL: Record<string, string> = {
  sms: "SMS", whatsapp: "WhatsApp", email: "Email", instagram: "Instagram",
  messenger: "Messenger", telephone: "Téléphone", autre: "Autre",
};

export default function Inbox() {
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<"a_traiter" | "traite" | "archive">("a_traiter");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("quick_captures")
      .select("*, clients(name), projects(name), tasks(title), print_orders(description)")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  };

  useEffect(() => { load(); }, [tab, open]);

  const archive = async (id: string) => {
    await supabase.from("quick_captures").update({ status: "archive" }).eq("id", id);
    load();
  };

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <PageHeader
        title="Inbox"
        description="Captures rapides et messages clients à traiter"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Nouvelle capture
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="a_traiter">À traiter</TabsTrigger>
          <TabsTrigger value="traite">Traitées</TabsTrigger>
          <TabsTrigger value="archive">Archivées</TabsTrigger>
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <InboxIcon className="h-6 w-6 mx-auto mb-2 opacity-50" />
          Aucune capture {tab === "a_traiter" ? "à traiter" : tab === "traite" ? "traitée" : "archivée"}.
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{SOURCE_LABEL[it.source] ?? it.source}</Badge>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(it.created_at)}</span>
                </div>
                {tab === "a_traiter" && (
                  <Button size="sm" variant="ghost" onClick={() => archive(it.id)}>
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {it.ai_summary && <div className="text-sm font-medium mb-1">{it.ai_summary}</div>}
              <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{it.content}</div>
              <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
                {it.clients?.name && (
                  <Link to={`/clients/${it.client_id}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <ExternalLink className="h-3 w-3" /> {it.clients.name}
                  </Link>
                )}
                {it.projects?.name && (
                  <Link to={`/projets/${it.project_id}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <ExternalLink className="h-3 w-3" /> {it.projects.name}
                  </Link>
                )}
                {it.tasks?.title && (
                  <Link to={`/taches/${it.task_id}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <ExternalLink className="h-3 w-3" /> {it.tasks.title}
                  </Link>
                )}
                {it.print_orders?.description && (
                  <Link to={`/impressions/${it.print_order_id}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <ExternalLink className="h-3 w-3" /> {it.print_orders.description}
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <QuickCapture open={open} onOpenChange={setOpen} />
    </div>
  );
}