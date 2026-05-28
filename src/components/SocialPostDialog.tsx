import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Upload, X, Check, Plus } from "lucide-react";

export type SocialPost = {
  id?: string;
  client_id: string;
  scheduled_at: string | null;
  platforms: string[];
  format: string;
  title: string;
  caption: string | null;
  notes: string | null;
  status: string;
  media: { path: string; name: string }[];
  checklist: { text: string; done: boolean }[];
  event_name: string | null;
  pillar: string | null;
};

const PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok", "pinterest", "autre"];
const FORMATS = ["reel", "post", "carrousel", "story", "linkedin", "video", "autre"];
const STATUSES: { value: string; label: string }[] = [
  { value: "idee", label: "Idée" },
  { value: "a_faire", label: "À faire" },
  { value: "pret", label: "Prêt" },
  { value: "programme", label: "Programmé" },
  { value: "publie", label: "Publié" },
  { value: "annule", label: "Annulé" },
];

export default function SocialPostDialog({
  open,
  onOpenChange,
  clientId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  initial?: Partial<SocialPost>;
  onSaved: () => void;
}) {
  const empty: SocialPost = {
    client_id: clientId,
    scheduled_at: null,
    platforms: ["instagram"],
    format: "post",
    title: "",
    caption: "",
    notes: "",
    status: "idee",
    media: [],
    checklist: [],
    event_name: null,
    pillar: null,
  };
  const [post, setPost] = useState<SocialPost>(empty);
  const [busy, setBusy] = useState(false);
  const [newCheck, setNewCheck] = useState("");

  useEffect(() => {
    if (open) setPost({ ...empty, ...(initial as any) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const togglePlatform = (p: string) => {
    setPost((s) => ({
      ...s,
      platforms: s.platforms.includes(p) ? s.platforms.filter((x) => x !== p) : [...s.platforms, p],
    }));
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const uploaded: { path: string; name: string }[] = [];
    for (const f of Array.from(files)) {
      const path = `${clientId}/${crypto.randomUUID()}-${f.name}`;
      const { error } = await supabase.storage.from("social-media").upload(path, f);
      if (error) {
        toast.error(error.message);
        continue;
      }
      uploaded.push({ path, name: f.name });
    }
    setPost((s) => ({ ...s, media: [...s.media, ...uploaded] }));
    setBusy(false);
  };

  const removeMedia = async (path: string) => {
    await supabase.storage.from("social-media").remove([path]);
    setPost((s) => ({ ...s, media: s.media.filter((m) => m.path !== path) }));
  };

  const save = async () => {
    if (!post.title.trim()) return toast.error("Titre requis");
    setBusy(true);
    const payload: any = {
      client_id: clientId,
      scheduled_at: post.scheduled_at || null,
      platforms: post.platforms,
      format: post.format,
      title: post.title.trim(),
      caption: post.caption,
      notes: post.notes,
      status: post.status,
      media: post.media,
      checklist: post.checklist,
      event_name: post.event_name,
      pillar: post.pillar,
    };
    const res = post.id
      ? await supabase.from("social_posts").update(payload).eq("id", post.id)
      : await supabase.from("social_posts").insert(payload);
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Enregistré");
    onSaved();
    onOpenChange(false);
  };

  const remove = async () => {
    if (!post.id) return;
    if (!confirm("Supprimer ce post ?")) return;
    await supabase.from("social_posts").delete().eq("id", post.id);
    for (const m of post.media) await supabase.storage.from("social-media").remove([m.path]);
    toast.success("Supprimé");
    onSaved();
    onOpenChange(false);
  };

  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{post.id ? "Modifier le post" : "Nouveau post"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre *</Label>
            <Input autoFocus value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date / heure</Label>
              <Input
                type="datetime-local"
                value={toLocalInput(post.scheduled_at)}
                onChange={(e) => setPost({ ...post, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Statut</Label>
              <Select value={post.status} onValueChange={(v) => setPost({ ...post, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Plateformes</Label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => {
                const on = post.platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`px-2.5 py-1 rounded-md text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-secondary"}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <Select value={post.format} onValueChange={(v) => setPost({ ...post, format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pilier</Label>
              <Input value={post.pillar ?? ""} onChange={(e) => setPost({ ...post, pillar: e.target.value || null })} placeholder="Pool Parties, Mariages…" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Événement lié</Label>
            <Input value={post.event_name ?? ""} onChange={(e) => setPost({ ...post, event_name: e.target.value || null })} placeholder="Ex. Opening Jungle Pool Party" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Légende / texte</Label>
            <Textarea rows={6} value={post.caption ?? ""} onChange={(e) => setPost({ ...post, caption: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes internes</Label>
            <Textarea rows={3} value={post.notes ?? ""} onChange={(e) => setPost({ ...post, notes: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fichiers (visuels, brouillons)</Label>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:bg-secondary/50 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" /> Ajouter des fichiers…
              <input type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
            </label>
            {post.media.length > 0 && (
              <div className="space-y-1">
                {post.media.map((m) => (
                  <MediaRow key={m.path} media={m} onRemove={() => removeMedia(m.path)} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Checklist</Label>
            <div className="space-y-1">
              {post.checklist.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPost((s) => ({ ...s, checklist: s.checklist.map((x, j) => j === i ? { ...x, done: !x.done } : x) }))}
                    className={`h-4 w-4 border rounded flex items-center justify-center ${c.done ? "bg-primary text-primary-foreground border-primary" : ""}`}
                  >
                    {c.done && <Check className="h-3 w-3" />}
                  </button>
                  <span className={`flex-1 text-sm ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPost((s) => ({ ...s, checklist: s.checklist.filter((_, j) => j !== i) }))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <Input
                  placeholder="Ajouter une tâche…"
                  value={newCheck}
                  onChange={(e) => setNewCheck(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCheck.trim()) {
                      setPost((s) => ({ ...s, checklist: [...s.checklist, { text: newCheck.trim(), done: false }] }));
                      setNewCheck("");
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => {
                  if (newCheck.trim()) {
                    setPost((s) => ({ ...s, checklist: [...s.checklist, { text: newCheck.trim(), done: false }] }));
                    setNewCheck("");
                  }
                }}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {post.id && (
            <Button variant="ghost" onClick={remove} className="text-destructive mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={busy}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MediaRow({ media, onRemove }: { media: { path: string; name: string }; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("social-media").createSignedUrl(media.path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [media.path]);
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded border bg-secondary/30 text-sm">
      <span className="flex-1 truncate">{media.name}</span>
      {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Ouvrir</a>}
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}