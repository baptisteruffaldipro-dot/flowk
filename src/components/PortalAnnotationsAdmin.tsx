import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MapPin } from "lucide-react";

export default function PortalAnnotationsAdmin({ portalId }: { portalId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("portal_annotations" as any).select("*").eq("portal_id", portalId).order("created_at");
    setItems((data as any[]) ?? []);
  };
  useEffect(() => { load(); }, [portalId]);
  if (!items.length) return null;
  const byFile = items.reduce((m: Record<string, any[]>, a) => ((m[a.file_name] ||= []).push(a), m), {});
  const open = items.filter((a) => !a.resolved).length;
  return (
    <section className="rounded-lg border border-border/70 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> Annotations du client sur les documents
        {open > 0 && <Badge variant="destructive" className="ml-auto text-[10px]">{open} à traiter</Badge>}
      </div>
      {(Object.entries(byFile) as [string, any[]][]).map(([file, list]) => (
        <div key={file} className="space-y-1.5">
          <div className="text-xs font-medium">{file}</div>
          {list.map((a, i) => (
            <div key={a.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-xs">
              <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${a.resolved ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="whitespace-pre-wrap">{a.comment}</div>
                <div className="text-[10px] text-muted-foreground">Page {a.page} · {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</div>
              </div>
              {a.resolved ? (
                <Badge variant="outline" className="text-[10px]">Corrigé</Badge>
              ) : (
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={async () => {
                  await supabase.from("portal_annotations" as any).update({ resolved: true }).eq("id", a.id);
                  load();
                }}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Corrigé
                </Button>
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
