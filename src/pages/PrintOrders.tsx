import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BAT_PRINT_STATUS_LABEL, fmtDate } from "@/lib/format";

export default function PrintOrders() {
  const [bats, setBats] = useState<any[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("bats")
      .select("*, clients(name), projects(name)")
      .eq("status", "valide")
      .order("validated_at", { ascending: false });
    if (error) toast.error(error.message);
    setBats(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, print_status: string) => {
    const { error } = await supabase.from("bats").update({ print_status: print_status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Impressions"
        description={`${bats.length} BAT validé${bats.length > 1 ? "s" : ""} à produire`}
      />
      <Card className="overflow-hidden">
        {bats.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Aucun BAT validé pour le moment. Les BAT apparaîtront ici une fois validés par le client.
          </div>
        ) : (
          <div className="divide-y">
            {bats.map((b) => (
              <div key={b.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm hover:bg-secondary/40">
                <Link to={`/bats/${b.id}`} className="col-span-4 min-w-0">
                  <div className="font-medium truncate hover:underline">{b.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.clients?.name}{b.projects?.name ? ` · ${b.projects.name}` : ""}
                    {b.reference ? ` · réf. ${b.reference}` : ""}
                  </div>
                </Link>
                <div className="col-span-2 text-xs">
                  {b.quantity ? <Badge variant="secondary">{b.quantity} ex.</Badge> : <span className="text-muted-foreground">—</span>}
                </div>
                <div className="col-span-3 text-xs text-muted-foreground truncate">
                  {[b.format, b.support].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">
                  {fmtDate(b.validated_at)}
                </div>
                <div className="col-span-2">
                  <Select value={b.print_status ?? "a_imprimer"} onValueChange={(v) => updateStatus(b.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BAT_PRINT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
