import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { Lightbulb, ImagePlus, Trash2, Pin, PinOff, Link2, Loader2, Plus, X } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export type Idea = {
  id: string;
  title: string | null;
  content: string | null;
  images: string[];
  links: string[];
  pinned: boolean;
  color: string | null;
  client_id: string | null;
  project_id: string | null;
  task_id: string | null;
  created_at: string;
  updated_at: string;
};

const COLORS = [
  { key: "amber", cls: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900" },
  { key: "sky", cls: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900" },
  { key: "emerald", cls: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900" },
  { key: "rose", cls: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900" },
  { key: "violet", cls: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900" },
];
const colorCls = (c: string | null) => COLORS.find((x) => x.key === c)?.cls ?? "bg-card border-border";

const URL_RE = /https?:\/\/[^\s)]+/g;

function IdeaImages({ paths, onRemove }: { paths: string[]; onRemove?: (p: string) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!paths.length) return setUrls({});
      const { data } = await supabase.storage.from("ideas").createSignedUrls(paths, 3600);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      data.forEach((d: any) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
      setUrls(map);
    })();
    return () => { cancelled = true; };
  }, [paths.join("|")]);

  if (!paths.length) return null;
  return (
    <div className="grid grid-cols-3 gap-1.5 mt-2">
      {paths.map((p) => (
        <div key={p} className="relative group rounded-md overflow-hidden border border-border bg-muted/30">
          {urls[p] ? (
            <a href={urls[p]} target="_blank" rel="noreferrer">
              <img src={urls[p]} alt="Inspiration" loading="lazy" className="h-24 w-full object-cover" />
            </a>
          ) : (
            <div className="h-24 w-full animate-pulse" />
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(p)}
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Supprimer l'image"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function IdeasBoard({
  projectId = null,
  taskId = null,
  clientId = null,
  title = "Idées / Notes",
  showGlobal = false,
}: {
  projectId?: string | null;
  taskId?: string | null;
  clientId?: string | null;
  title?: string;
  showGlobal?: boolean;
}) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [linkProject, setLinkProject] = useState<string>("none");
  const [linkTask, setLinkTask] = useState<string>("none");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showGlobal) return;
    (async () => {
      const [p, t] = await Promise.all([
        supabase.from("projects").select("id,name").eq("archived", false).order("name"),
        supabase.from("tasks").select("id,title").order("updated_at", { ascending: false }).limit(200),
      ]);
      setProjects(p.data ?? []);
      setTasks(t.data ?? []);
    })();
  }, [showGlobal]);


  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("ideas" as any).select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (taskId) q = q.eq("task_id", taskId);
    else if (projectId) q = q.eq("project_id", projectId);
    else if (clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setIdeas(((data as any) ?? []).map((d: any) => ({ ...d, images: d.images ?? [], links: d.links ?? [] })));
  }, [projectId, taskId, clientId]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    const paths: string[] = [];
    for (const f of list) {
      const ext = f.name.split(".").pop() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("ideas").upload(path, f, { upsert: false });
      if (error) toast.error(error.message);
      else paths.push(path);
    }
    setUploading(false);
    setPending((p) => [...p, ...paths]);
    if (paths.length) setExpanded(true);
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []);
    if (files.length) {
      e.preventDefault();
      await uploadFiles(files);
    }
  };

  const create = async () => {
    if (!draft.trim() && !draftTitle.trim() && !pending.length) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const links = Array.from(new Set((draft.match(URL_RE) ?? [])));
    const { error } = await supabase.from("ideas" as any).insert({
      title: draftTitle.trim() || null,
      content: draft.trim() || null,
      images: pending,
      links,
      project_id: projectId ?? (linkProject !== "none" ? linkProject : null),
      task_id: taskId ?? (linkTask !== "none" ? linkTask : null),
      client_id: clientId,
      created_by: u.user?.id ?? null,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDraft(""); setDraftTitle(""); setPending([]); setExpanded(false);
    setLinkProject("none"); setLinkTask("none");
    load();

  };

  const patch = async (id: string, p: Partial<Idea>) => {
    setIdeas((arr) => arr.map((i) => (i.id === id ? { ...i, ...p } as Idea : i)));
    const { error } = await supabase.from("ideas" as any).update(p as any).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  const remove = async (idea: Idea) => {
    const { error } = await supabase.from("ideas" as any).delete().eq("id", idea.id);
    if (error) return toast.error(error.message);
    if (idea.images.length) await supabase.storage.from("ideas").remove(idea.images);
    setIdeas((arr) => arr.filter((i) => i.id !== idea.id));
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" /> {title}
        </h2>
        <span className="text-xs text-muted-foreground">{ideas.length} note{ideas.length > 1 ? "s" : ""}</span>
      </div>

      {/* Composer */}
      <div
        className="rounded-lg border border-border p-3 bg-muted/20"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files); }}
      >
        {expanded && (
          <Input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Titre (optionnel)"
            className="mb-2 h-8 text-sm"
          />
        )}
        <Textarea
          value={draft}
          onFocus={() => setExpanded(true)}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") create(); }}
          placeholder="Note rapide, idée, lien d'inspiration… (colle ou glisse une image)"
          rows={expanded ? 3 : 1}
          className="text-sm resize-none"
        />
        <IdeaImages paths={pending} onRemove={(p) => { setPending((a) => a.filter((x) => x !== p)); supabase.storage.from("ideas").remove([p]); }} />
        {showGlobal && expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <Select value={linkProject} onValueChange={setLinkProject}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Lier à un projet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun projet</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={linkTask} onValueChange={setLinkTask}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Lier à une tâche" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune tâche</SelectItem>
                {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2 mt-2">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Image
          </Button>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">⌘+Entrée pour enregistrer</span>
          <Button size="sm" className="ml-auto gap-1.5" onClick={create} disabled={saving || (!draft.trim() && !draftTitle.trim() && !pending.length)}>
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </Button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-xs text-muted-foreground mt-4">Chargement…</div>
      ) : ideas.length === 0 ? (
        <div className="text-xs text-muted-foreground mt-4">Aucune note pour le moment.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {ideas.map((idea) => (
            <div key={idea.id} className={`rounded-lg border p-3 ${colorCls(idea.color)}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {idea.title && <div className="text-sm font-medium break-words">{idea.title}</div>}
                  {idea.content && <div className="text-sm whitespace-pre-wrap break-words mt-0.5">{idea.content}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => patch(idea.id, { pinned: !idea.pinned })} className="text-muted-foreground hover:text-foreground" aria-label="Épingler">
                    {idea.pinned ? <Pin className="h-3.5 w-3.5 text-amber-500" /> : <PinOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => remove(idea)} className="text-muted-foreground hover:text-destructive" aria-label="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {showGlobal && (idea.project_id || idea.task_id) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {idea.project_id && (
                    <Link to={`/projets/${idea.project_id}`}>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {projects.find((p) => p.id === idea.project_id)?.name ?? "Projet"}
                      </Badge>
                    </Link>
                  )}
                  {idea.task_id && (
                    <Link to={`/taches/${idea.task_id}`}>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {tasks.find((t) => t.id === idea.task_id)?.title ?? "Tâche"}
                      </Badge>
                    </Link>
                  )}
                </div>
              )}

              <IdeaImages paths={idea.images} />


              {idea.links.length > 0 && (
                <div className="mt-2 space-y-1">
                  {idea.links.map((l) => (
                    <a key={l} href={l} target="_blank" rel="noreferrer" className="text-[11px] text-primary inline-flex items-center gap-1 truncate max-w-full hover:underline">
                      <Link2 className="h-3 w-3 shrink-0" /> <span className="truncate">{l}</span>
                    </a>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 mt-3">
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => patch(idea.id, { color: idea.color === c.key ? null : c.key })}
                    className={`h-3.5 w-3.5 rounded-full border ${c.cls} ${idea.color === c.key ? "ring-2 ring-offset-1 ring-foreground/30" : ""}`}
                    aria-label={`Couleur ${c.key}`}
                  />
                ))}
                <Badge variant="outline" className="ml-auto text-[10px] font-normal">{fmtDateTime(idea.updated_at)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
