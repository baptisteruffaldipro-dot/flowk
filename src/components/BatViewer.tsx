import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fmtDateTime } from "@/lib/format";

interface Annotation {
  id: string;
  x: number;
  y: number;
  page: number;
  comment: string;
  resolved: boolean;
  author_id: string | null;
  created_at: string;
}

interface Props {
  printOrderId?: string;
  taskId?: string;
  filePath: string; // path in 'bat' bucket
  canAnnotate: boolean;
  canResolve: boolean; // admin can resolve
}

export default function BatViewer({ printOrderId, taskId, filePath, canAnnotate, canResolve }: Props) {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const isImage = useMemo(() => /\.(png|jpe?g|webp|gif)$/i.test(filePath), [filePath]);
  const isPdf = useMemo(() => /\.pdf$/i.test(filePath), [filePath]);

  const loadUrl = async () => {
    const { data, error } = await supabase.storage.from("bat").createSignedUrl(filePath, 60 * 60);
    if (error) toast.error(error.message);
    else setUrl(data?.signedUrl ?? null);
  };

  const loadAnnotations = async () => {
    let q = supabase.from("bat_annotations").select("*").order("created_at", { ascending: true });
    if (printOrderId) q = q.eq("print_order_id", printOrderId);
    else if (taskId) q = q.eq("task_id", taskId);
    const { data } = await q;
    setAnnotations((data ?? []) as Annotation[]);
  };

  useEffect(() => {
    loadUrl();
    loadAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, printOrderId, taskId]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canAnnotate || !isImage) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPending({ x, y });
    setDraft("");
  };

  const saveAnnotation = async () => {
    if (!pending || !draft.trim()) return;
    const payload: any = {
      x: pending.x,
      y: pending.y,
      page: 1,
      comment: draft.trim(),
      author_id: user?.id ?? null,
    };
    if (printOrderId) payload.print_order_id = printOrderId;
    if (taskId) payload.task_id = taskId;
    const { error } = await supabase.from("bat_annotations").insert(payload);
    if (error) return toast.error(error.message);
    setPending(null);
    setDraft("");
    loadAnnotations();

    // Increment client_revisions_count on task
    if (taskId) {
      const { data: t } = await supabase.from("tasks").select("client_revisions_count").eq("id", taskId).maybeSingle();
      if (t) await supabase.from("tasks").update({ client_revisions_count: (t.client_revisions_count ?? 0) + 1 }).eq("id", taskId);
    }
  };

  const resolve = async (id: string) => {
    await supabase.from("bat_annotations").update({ resolved: true }).eq("id", id);
    loadAnnotations();
  };

  const remove = async (id: string) => {
    await supabase.from("bat_annotations").delete().eq("id", id);
    loadAnnotations();
  };

  if (!url) return <div className="p-8 text-sm text-muted-foreground">Chargement du document…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <Card className="overflow-hidden p-0">
        {isImage ? (
          <div
            ref={imgRef}
            className={`relative ${canAnnotate ? "cursor-crosshair" : ""}`}
            onClick={handleClick}
          >
            <img src={url} alt="BAT" className="w-full h-auto block select-none" draggable={false} />
            {annotations.map((a, i) => (
              <button
                key={a.id}
                onClick={(e) => { e.stopPropagation(); setOpenId(openId === a.id ? null : a.id); }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[11px] font-semibold text-white shadow-md ring-2 ring-white transition ${a.resolved ? "bg-emerald-500" : "bg-rose-500 hover:scale-110"}`}
                style={{ left: `${a.x}%`, top: `${a.y}%` }}
              >
                {i + 1}
              </button>
            ))}
            {pending && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[11px] font-semibold flex items-center justify-center ring-2 ring-white animate-pulse"
                style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
              >
                +
              </div>
            )}
          </div>
        ) : isPdf ? (
          <iframe src={url} className="w-full h-[700px]" title="BAT PDF" />
        ) : (
          <div className="p-12 text-center">
            <a href={url} target="_blank" rel="noreferrer" className="text-primary underline text-sm">
              Télécharger le fichier
            </a>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {pending && (
          <Card className="p-3 border-primary">
            <div className="text-xs font-semibold mb-2">Nouveau commentaire</div>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Décrivez la modification…" />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={saveAnnotation}>Ajouter</Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        )}

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> Annotations ({annotations.length})
          </div>
          {annotations.length === 0 ? (
            <Card className="p-4 text-xs text-muted-foreground text-center">
              {canAnnotate && isImage ? "Cliquez sur le document pour ajouter un commentaire" : "Aucune annotation"}
            </Card>
          ) : (
            <div className="space-y-2 max-h-[640px] overflow-y-auto">
              {annotations.map((a, i) => (
                <Card key={a.id} className={`p-3 text-xs ${openId === a.id ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 w-5 h-5 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${a.resolved ? "bg-emerald-500" : "bg-rose-500"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground whitespace-pre-wrap">{a.comment}</div>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{fmtDateTime(a.created_at)}</span>
                        {a.resolved && <Badge variant="outline" className="text-[9px] py-0">Résolu</Badge>}
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        {canResolve && !a.resolved && (
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => resolve(a.id)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Résoudre
                          </Button>
                        )}
                        {(canResolve || (a.author_id === user?.id && !a.resolved)) && (
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => remove(a.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}