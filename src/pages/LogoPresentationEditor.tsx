import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Eye, Save, ArrowLeft, Copy, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import LogoPresentationView from "@/components/logo-presentation/LogoPresentationView";
import ImageUpload from "@/components/logo-presentation/ImageUpload";
import FontUpload from "@/components/logo-presentation/FontUpload";
import RichTextEditor from "@/components/logo-presentation/RichTextEditor";
import type { LogoPresentation, LogoVariant, LogoTrack, MoodboardUniverse, ColorsTrack, TypographyTrack, InSituTrack } from "@/data/logo-presentations/types";
import { emptyLogoPresentationContent, emptyTrack, emptyUniverse, emptyColorsTrack, emptyTypographyTrack, emptyInSituTrack } from "@/data/logo-presentations/empty";

type DBRow = {
  id: string;
  project_name: string;
  client_name: string;
  client_id: string | null;
  version: string;
  tagline: string;
  content: any;
  share_token: string | null;
  is_published: boolean;
};

const genToken = () => {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
};

const ensureContent = (raw: any) => {
  const c = { ...emptyLogoPresentationContent, ...(raw || {}) };
  c.brief = { ...emptyLogoPresentationContent.brief, ...(c.brief || {}) };
  const mb: any = c.moodboard || {};
  if (Array.isArray(mb.universes) && mb.universes.length > 0) {
    c.moodboard = { universes: mb.universes.map((u: any, i: number) => ({ ...emptyUniverse(`Univers ${i + 1}`), ...u })) };
  } else if (mb.intro || (Array.isArray(mb.keywords) && mb.keywords.length) || (Array.isArray(mb.images) && mb.images.length)) {
    c.moodboard = { universes: [{ ...emptyUniverse("Univers 1"), intro: mb.intro || "", keywords: mb.keywords || [], images: mb.images || [] }] };
  } else {
    c.moodboard = { universes: [emptyUniverse("Univers 1")] };
  }
  const lg: any = c.logos || {};
  if (Array.isArray(lg.tracks) && lg.tracks.length > 0) {
    c.logos = { tracks: lg.tracks.map((t: any, i: number) => ({ ...emptyTrack(`Piste ${i + 1}`), ...t })) };
  } else if (lg.primary || lg.secondary || lg.submark || lg.intro) {
    const t0 = emptyTrack("Piste 1");
    c.logos = { tracks: [{
      ...t0,
      intro: lg.intro || "",
      primary: { ...t0.primary, ...(lg.primary || {}) },
      secondary: { ...t0.secondary, ...(lg.secondary || {}) },
      submark: { ...t0.submark, ...(lg.submark || {}) },
    }] };
  } else {
    c.logos = { tracks: [emptyTrack("Piste 1")] };
  }
  const co: any = c.colors || {};
  if (Array.isArray(co.tracks) && co.tracks.length > 0) {
    c.colors = { tracks: co.tracks.map((t: any, i: number) => ({ ...emptyColorsTrack(`Piste ${i + 1}`), ...t })) };
  } else if (co.intro || (Array.isArray(co.palette) && co.palette.length)) {
    c.colors = { tracks: [{ ...emptyColorsTrack("Piste 1"), intro: co.intro || "", palette: co.palette || [] }] };
  } else {
    c.colors = { tracks: [emptyColorsTrack("Piste 1")] };
  }
  const ty: any = c.typography || {};
  if (Array.isArray(ty.tracks) && ty.tracks.length > 0) {
    c.typography = { tracks: ty.tracks.map((t: any, i: number) => ({ ...emptyTypographyTrack(`Piste ${i + 1}`), ...t })) };
  } else if (ty.intro || (Array.isArray(ty.fonts) && ty.fonts.length)) {
    c.typography = { tracks: [{ ...emptyTypographyTrack("Piste 1"), intro: ty.intro || "", fonts: ty.fonts || [] }] };
  } else {
    c.typography = { tracks: [emptyTypographyTrack("Piste 1")] };
  }
  const is: any = c.inSitu || {};
  if (Array.isArray(is.tracks) && is.tracks.length > 0) {
    c.inSitu = { tracks: is.tracks.map((t: any, i: number) => ({ ...emptyInSituTrack(`Piste ${i + 1}`), ...t })) };
  } else if (is.intro || (Array.isArray(is.items) && is.items.length)) {
    c.inSitu = { tracks: [{ ...emptyInSituTrack("Piste 1"), intro: is.intro || "", items: is.items || [] }] };
  } else {
    c.inSitu = { tracks: [emptyInSituTrack("Piste 1")] };
  }
  return c;
};

const buildPresentation = (row: DBRow): LogoPresentation => ({
  slug: row.id,
  client: row.client_name,
  projectName: row.project_name,
  version: row.version,
  tagline: row.tagline,
  ...ensureContent(row.content),
});

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="p-5 space-y-4">
    <h3 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">{title}</h3>
    {children}
  </Card>
);

const StringList = ({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) => (
  <div className="space-y-2">
    {value.map((v, i) => (
      <div key={i} className="flex gap-2">
        <Input value={v} onChange={(e) => { const n = [...value]; n[i] = e.target.value; onChange(n); }} placeholder={placeholder} />
        <Button size="icon" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ))}
    <Button size="sm" variant="outline" onClick={() => onChange([...value, ""])}>
      <Plus className="h-4 w-4 mr-1" /> Ajouter
    </Button>
  </div>
);

function VariantEditor({ variant, onChange, folder }: { variant: LogoVariant; onChange: (v: LogoVariant) => void; folder: string }) {
  const update = (patch: Partial<LogoVariant>) => onChange({ ...variant, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Libellé</Label><Input value={variant.label} onChange={(e) => update({ label: e.target.value })} /></div>
        <div><Label>Usage</Label><Input value={variant.usage} onChange={(e) => update({ usage: e.target.value })} /></div>
      </div>
      <div><Label>Description</Label><RichTextEditor value={variant.description} onChange={(html) => update({ description: html })} minHeight="120px" /></div>
      <div>
        <Label>Visuels (1er = grande image, 2 suivants = carrés)</Label>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
          {variant.shots.map((s, i) => (
            <Card key={i} className="p-3 space-y-2 bg-muted/20">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {i === 0 ? "Image principale (rectangle)" : i < 3 ? `Carré ${i}` : "Visuel supplémentaire"}
              </div>
              <ImageUpload
                value={s.imageUrl}
                onChange={(url) => {
                  const n = [...variant.shots]; n[i] = { ...n[i], imageUrl: url }; update({ shots: n });
                }}
                folder={folder}
                aspect={i === 0 ? "aspect-[16/9]" : "aspect-square"}
              />
              <Input
                placeholder="Légende (optionnel)"
                value={s.caption || ""}
                onChange={(e) => {
                  const n = [...variant.shots]; n[i] = { ...n[i], caption: e.target.value }; update({ shots: n });
                }}
                className="h-8 text-xs"
              />
              <Button size="sm" variant="ghost" className="w-full" onClick={() => update({ shots: variant.shots.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
              </Button>
            </Card>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => update({ shots: [...variant.shots, { background: "light", imageUrl: "" }] })}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un visuel
        </Button>
      </div>
    </div>
  );
}

export default function LogoPresentationEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<DBRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("logo_presentations" as any).select("*").eq("id", id).single().then(({ data, error }) => {
      if (error || !data) { toast.error("Introuvable"); navigate("/logos"); return; }
      const r = data as any;
      r.content = ensureContent(r.content);
      setRow(r);
    });
  }, [id, navigate]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase.from("logo_presentations" as any).update({
      project_name: row.project_name,
      client_name: row.client_name,
      version: row.version,
      tagline: row.tagline,
      content: row.content,
      is_published: row.is_published,
      share_token: row.share_token,
    }).eq("id", row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Enregistré");
  };

  const togglePublish = async (publish: boolean) => {
    if (!row) return;
    const next: Partial<DBRow> = { is_published: publish };
    if (publish && !row.share_token) next.share_token = genToken();
    const updated = { ...row, ...next };
    setRow(updated);
    const { error } = await supabase.from("logo_presentations" as any).update({
      is_published: updated.is_published,
      share_token: updated.share_token,
    }).eq("id", updated.id);
    if (error) { toast.error(error.message); return; }
    toast.success(publish ? "Publié — lien actif" : "Dépublié");
  };

  const copyShareLink = () => {
    if (!row?.share_token) return;
    const url = `${window.location.origin}/p/logo/${row.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Lien copié");
    setTimeout(() => setCopied(false), 2000);
  };

  const sendByEmail = async () => {
    if (!row?.share_token) return;
    if (!row.is_published) { toast.error("Active d'abord le lien public"); return; }
    if (!row.client_id) { toast.error("Aucun client lié à cette présentation"); return; }
    const { data: client } = await supabase
      .from("clients")
      .select("name,email")
      .eq("id", row.client_id)
      .maybeSingle();
    if (!client?.email) { toast.error("Le client n'a pas d'email enregistré"); return; }
    setSending(true);
    const presentationUrl = `${window.location.origin}/p/logo/${row.share_token}`;
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "logo-ready",
        recipientEmail: client.email,
        idempotencyKey: `logo-ready-${row.id}-${Date.now()}`,
        templateData: {
          name: client.name ?? undefined,
          projectName: row.project_name,
          presentationUrl,
        },
      },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Échec de l'envoi");
      return;
    }
    toast.success(`Email envoyé à ${client.email}`, {
      description: "Une copie a été transmise à bonjour@atelier-rufo.fr",
    });
  };

  const update = useCallback(<K extends keyof DBRow>(key: K, value: DBRow[K]) => {
    setRow((r) => r ? { ...r, [key]: value } : r);
  }, []);

  const updateContent = useCallback((path: (string | number)[], value: any) => {
    setRow((r) => {
      if (!r) return r;
      const content = JSON.parse(JSON.stringify(r.content));
      let cur = content;
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i] as any];
      cur[path[path.length - 1] as any] = value;
      return { ...r, content };
    });
  }, []);

  if (!row) return <div className="p-8 text-muted-foreground">Chargement…</div>;

  if (preview) {
    return (
      <div className="relative">
        <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 bg-background/95 backdrop-blur border-b">
          <Button size="sm" variant="ghost" onClick={() => setPreview(false)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour à l'édition
          </Button>
        </div>
        <LogoPresentationView presentation={buildPresentation(row)} />
      </div>
    );
  }

  const c = row.content;
  const folder = row.id;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32">
      <PageHeader
        title={row.project_name || "Présentation logo"}
        description={row.client_name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/logos")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            <Button variant="outline" onClick={() => setPreview(true)}>
              <Eye className="h-4 w-4 mr-1" /> Aperçu
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "…" : "Enregistrer"}
            </Button>
          </div>
        }
      />

      <Card className="p-5 mt-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Switch checked={row.is_published} onCheckedChange={togglePublish} />
          <div>
            <div className="font-medium text-sm">Lien public partageable</div>
            <div className="text-xs text-muted-foreground">
              {row.is_published ? "Activé — toute personne avec le lien peut consulter" : "Désactivé"}
            </div>
          </div>
        </div>
        {row.is_published && row.share_token && (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <code className="flex-1 px-3 py-2 bg-muted rounded text-xs truncate">
              {window.location.origin}/p/logo/{row.share_token}
            </code>
            <Button size="sm" variant="outline" onClick={copyShareLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={sendByEmail} disabled={sending || !row.client_id}>
              <Mail className="h-4 w-4 mr-1" /> {sending ? "Envoi…" : "Envoyer par email"}
            </Button>
          </div>
        )}
      </Card>
      {row.is_published && row.share_token && (
        <p className="text-xs text-muted-foreground mt-2 px-1">
          L'email envoyé au client indique que ses propositions de logo (moodboard,
          pistes, couleurs, typographies et mises en situation) sont disponibles à la
          consultation, avec un bouton menant directement à ce lien.
        </p>
      )}

      <Tabs defaultValue="meta" className="mt-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="meta">En-tête</TabsTrigger>
          <TabsTrigger value="brief">Brief</TabsTrigger>
          <TabsTrigger value="moodboard">Moodboard</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
          <TabsTrigger value="colors">Couleurs</TabsTrigger>
          <TabsTrigger value="typo">Typographies</TabsTrigger>
          <TabsTrigger value="insitu">En action</TabsTrigger>
          <TabsTrigger value="livraison">Livraison</TabsTrigger>
        </TabsList>

        <TabsContent value="meta">
          <SectionCard title="En-tête du document">
            <div><Label>Nom du projet</Label><Input value={row.project_name} onChange={(e) => update("project_name", e.target.value)} /></div>
            <div><Label>Nom du client (affiché)</Label><Input value={row.client_name} onChange={(e) => update("client_name", e.target.value)} /></div>
            <div><Label>Version</Label><Input value={row.version} onChange={(e) => update("version", e.target.value)} /></div>
            <div><Label>Tagline (hero)</Label><Textarea rows={2} value={row.tagline} onChange={(e) => update("tagline", e.target.value)} /></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="brief">
          <SectionCard title="01 — Brief & contexte">
            <div><Label>Intro</Label><RichTextEditor value={c.brief.intro} onChange={(html) => updateContent(["brief", "intro"], html)} /></div>
            <div>
              <Label>Objectifs</Label>
              <StringList value={c.brief.objectives} onChange={(v) => updateContent(["brief", "objectives"], v)} placeholder="Objectif" />
            </div>
            <div>
              <Label>Livrables</Label>
              <StringList value={c.brief.deliverables} onChange={(v) => updateContent(["brief", "deliverables"], v)} placeholder="Livrable" />
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="moodboard" className="space-y-4">
          {(c.moodboard.universes as MoodboardUniverse[]).map((u, ui) => (
            <Card key={ui} className="p-5 space-y-4 border-2">
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 font-semibold"
                  value={u.name}
                  onChange={(e) => updateContent(["moodboard", "universes", ui, "name"], e.target.value)}
                  placeholder={`Univers ${ui + 1}`}
                />
                {c.moodboard.universes.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateContent(["moodboard", "universes"], c.moodboard.universes.filter((_: any, j: number) => j !== ui))}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Retirer cet univers
                  </Button>
                )}
              </div>
              <SectionCard title="Intro">
                <RichTextEditor value={u.intro} onChange={(html) => updateContent(["moodboard", "universes", ui, "intro"], html)} />
              </SectionCard>
              <SectionCard title="Mots-clés">
                <StringList value={u.keywords} onChange={(v) => updateContent(["moodboard", "universes", ui, "keywords"], v)} placeholder="Mot-clé" />
              </SectionCard>
              <SectionCard title="Références / Inspirations">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {u.images.map((img: any, i: number) => (
                    <Card key={i} className="p-3 space-y-2 bg-muted/20">
                      <ImageUpload
                        value={img.url}
                        onChange={(url) => {
                          const n = [...u.images]; n[i] = { ...n[i], url }; updateContent(["moodboard", "universes", ui, "images"], n);
                        }}
                        folder={`${folder}/moodboard/u-${ui}`}
                        aspect="aspect-square"
                      />
                      <Input
                        placeholder="Légende"
                        className="h-8 text-xs"
                        value={img.caption || ""}
                        onChange={(e) => {
                          const n = [...u.images]; n[i] = { ...n[i], caption: e.target.value }; updateContent(["moodboard", "universes", ui, "images"], n);
                        }}
                      />
                      <Button size="sm" variant="ghost" className="w-full" onClick={() => updateContent(["moodboard", "universes", ui, "images"], u.images.filter((_: any, j: number) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
                      </Button>
                    </Card>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => updateContent(["moodboard", "universes", ui, "images"], [...u.images, { url: "" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter une référence
                </Button>
              </SectionCard>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() => updateContent(["moodboard", "universes"], [...c.moodboard.universes, emptyUniverse(`Univers ${c.moodboard.universes.length + 1}`)])}
          >
            <Plus className="h-4 w-4 mr-1" /> Ajouter un univers
          </Button>
        </TabsContent>

        <TabsContent value="logos" className="space-y-4">
          {(c.logos.tracks as LogoTrack[]).map((track, ti) => (
            <Card key={ti} className="p-5 space-y-4 border-2">
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 font-semibold"
                  value={track.name}
                  onChange={(e) => updateContent(["logos", "tracks", ti, "name"], e.target.value)}
                  placeholder={`Piste ${ti + 1}`}
                />
                {c.logos.tracks.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateContent(["logos", "tracks"], c.logos.tracks.filter((_: any, j: number) => j !== ti))}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Retirer cette piste
                  </Button>
                )}
              </div>
              <SectionCard title="Intro de la piste">
                <RichTextEditor value={track.intro} onChange={(html) => updateContent(["logos", "tracks", ti, "intro"], html)} />
              </SectionCard>
              <SectionCard title="Logo principal (primaire)">
                <VariantEditor
                  variant={track.primary}
                  onChange={(v) => updateContent(["logos", "tracks", ti, "primary"], v)}
                  folder={`${folder}/logos/track-${ti}/primary`}
                />
              </SectionCard>
              <SectionCard title="Logo secondaire">
                <VariantEditor
                  variant={track.secondary}
                  onChange={(v) => updateContent(["logos", "tracks", ti, "secondary"], v)}
                  folder={`${folder}/logos/track-${ti}/secondary`}
                />
              </SectionCard>
              <SectionCard title="Submark (tertiaire)">
                <VariantEditor
                  variant={track.submark}
                  onChange={(v) => updateContent(["logos", "tracks", ti, "submark"], v)}
                  folder={`${folder}/logos/track-${ti}/submark`}
                />
              </SectionCard>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() => updateContent(["logos", "tracks"], [...c.logos.tracks, emptyTrack(`Piste ${c.logos.tracks.length + 1}`)])}
          >
            <Plus className="h-4 w-4 mr-1" /> Ajouter une piste de logo
          </Button>
        </TabsContent>

        <TabsContent value="colors" className="space-y-4">
          {(c.colors.tracks as ColorsTrack[]).map((ct, ti) => (
            <Card key={ti} className="p-5 space-y-4 border-2">
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 font-semibold"
                  value={ct.name}
                  onChange={(e) => updateContent(["colors", "tracks", ti, "name"], e.target.value)}
                  placeholder={`Piste ${ti + 1}`}
                />
                {c.colors.tracks.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateContent(["colors", "tracks"], c.colors.tracks.filter((_: any, j: number) => j !== ti))}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Retirer cette piste
                  </Button>
                )}
              </div>
              <SectionCard title="Intro">
                <RichTextEditor value={ct.intro} onChange={(html) => updateContent(["colors", "tracks", ti, "intro"], html)} />
              </SectionCard>
              <SectionCard title="Couleurs">
                <div className="space-y-2">
                  {ct.palette.map((col: any, i: number) => (
                    <Card key={i} className="p-3 grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_2fr_auto] gap-2 items-center bg-muted/20">
                      <input
                        type="color"
                        value={col.hex || "#000000"}
                        onChange={(e) => { const n = [...ct.palette]; n[i] = { ...n[i], hex: e.target.value }; updateContent(["colors", "tracks", ti, "palette"], n); }}
                        className="h-10 w-12 rounded cursor-pointer"
                      />
                      <Input placeholder="Nom (Vert pomme)" value={col.name} onChange={(e) => { const n = [...ct.palette]; n[i] = { ...n[i], name: e.target.value }; updateContent(["colors", "tracks", ti, "palette"], n); }} />
                      <Input placeholder="#9BCA3E" value={col.hex} onChange={(e) => { const n = [...ct.palette]; n[i] = { ...n[i], hex: e.target.value }; updateContent(["colors", "tracks", ti, "palette"], n); }} />
                      <Input placeholder="Usage" value={col.usage} onChange={(e) => { const n = [...ct.palette]; n[i] = { ...n[i], usage: e.target.value }; updateContent(["colors", "tracks", ti, "palette"], n); }} />
                      <Button size="icon" variant="ghost" onClick={() => updateContent(["colors", "tracks", ti, "palette"], ct.palette.filter((_: any, j: number) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => updateContent(["colors", "tracks", ti, "palette"], [...ct.palette, { name: "", hex: "#000000", usage: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Ajouter une couleur
                  </Button>
                </div>
              </SectionCard>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() => updateContent(["colors", "tracks"], [...c.colors.tracks, emptyColorsTrack(`Piste ${c.colors.tracks.length + 1}`)])}
          >
            <Plus className="h-4 w-4 mr-1" /> Ajouter une piste de couleurs
          </Button>
        </TabsContent>

        <TabsContent value="typo" className="space-y-4">
          {(c.typography.tracks as TypographyTrack[]).map((tt, ti) => (
            <Card key={ti} className="p-5 space-y-4 border-2">
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 font-semibold"
                  value={tt.name}
                  onChange={(e) => updateContent(["typography", "tracks", ti, "name"], e.target.value)}
                  placeholder={`Piste ${ti + 1}`}
                />
                {c.typography.tracks.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateContent(["typography", "tracks"], c.typography.tracks.filter((_: any, j: number) => j !== ti))}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Retirer cette piste
                  </Button>
                )}
              </div>
              <SectionCard title="Intro">
                <RichTextEditor value={tt.intro} onChange={(html) => updateContent(["typography", "tracks", ti, "intro"], html)} />
              </SectionCard>
              <SectionCard title="Polices">
                <div className="space-y-2">
                  {tt.fonts.map((f: any, i: number) => (
                    <Card key={i} className="p-3 space-y-2 bg-muted/20">
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Rôle (Principale)" value={f.role} onChange={(e) => { const n = [...tt.fonts]; n[i] = { ...n[i], role: e.target.value }; updateContent(["typography", "tracks", ti, "fonts"], n); }} />
                        <Input placeholder="Nom (GC Grind)" value={f.name} onChange={(e) => { const n = [...tt.fonts]; n[i] = { ...n[i], name: e.target.value }; updateContent(["typography", "tracks", ti, "fonts"], n); }} />
                      </div>
                      <Input placeholder="Échantillon (Aa Bb Cc)" value={f.sample} onChange={(e) => { const n = [...tt.fonts]; n[i] = { ...n[i], sample: e.target.value }; updateContent(["typography", "tracks", ti, "fonts"], n); }} />
                      <Input placeholder="Usage" value={f.usage} onChange={(e) => { const n = [...tt.fonts]; n[i] = { ...n[i], usage: e.target.value }; updateContent(["typography", "tracks", ti, "fonts"], n); }} />
                      <Input
                        placeholder="URL Google Fonts (https://fonts.googleapis.com/css2?family=...) ou @import / <link>"
                        value={f.googleFontUrl || ""}
                        onChange={(e) => { const n = [...tt.fonts]; n[i] = { ...n[i], googleFontUrl: e.target.value }; updateContent(["typography", "tracks", ti, "fonts"], n); }}
                      />
                      <FontUpload
                        value={f.fontFileUrl}
                        format={f.fontFileFormat}
                        folder={`${folder}/fonts`}
                        onChange={(url, format) => { const n = [...tt.fonts]; n[i] = { ...n[i], fontFileUrl: url, fontFileFormat: format }; updateContent(["typography", "tracks", ti, "fonts"], n); }}
                        onRemove={() => { const n = [...tt.fonts]; n[i] = { ...n[i], fontFileUrl: undefined, fontFileFormat: undefined }; updateContent(["typography", "tracks", ti, "fonts"], n); }}
                      />
                      <Button size="sm" variant="ghost" onClick={() => updateContent(["typography", "tracks", ti, "fonts"], tt.fonts.filter((_: any, j: number) => j !== i))}>
                        <Trash2 className="h-4 w-4 mr-1" /> Retirer
                      </Button>
                    </Card>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => updateContent(["typography", "tracks", ti, "fonts"], [...tt.fonts, { role: "", name: "", sample: "Aa Bb", usage: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Ajouter une police
                  </Button>
                </div>
              </SectionCard>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() => updateContent(["typography", "tracks"], [...c.typography.tracks, emptyTypographyTrack(`Piste ${c.typography.tracks.length + 1}`)])}
          >
            <Plus className="h-4 w-4 mr-1" /> Ajouter une piste de typographies
          </Button>
        </TabsContent>

        <TabsContent value="insitu" className="space-y-4">
          {(c.inSitu.tracks as InSituTrack[]).map((it, ti) => (
            <Card key={ti} className="p-5 space-y-4 border-2">
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 font-semibold"
                  value={it.name}
                  onChange={(e) => updateContent(["inSitu", "tracks", ti, "name"], e.target.value)}
                  placeholder={`Piste ${ti + 1}`}
                />
                {c.inSitu.tracks.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateContent(["inSitu", "tracks"], c.inSitu.tracks.filter((_: any, j: number) => j !== ti))}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Retirer cette piste
                  </Button>
                )}
              </div>
              <SectionCard title="Intro">
                <RichTextEditor value={it.intro} onChange={(html) => updateContent(["inSitu", "tracks", ti, "intro"], html)} />
              </SectionCard>
              <SectionCard title="Mises en situation">
                <div className="grid sm:grid-cols-2 gap-3">
                  {it.items.map((m: any, i: number) => (
                    <Card key={i} className="p-3 space-y-2 bg-muted/20">
                      <ImageUpload
                        value={m.url}
                        onChange={(url) => { const n = [...it.items]; n[i] = { ...n[i], url }; updateContent(["inSitu", "tracks", ti, "items"], n); }}
                        folder={`${folder}/insitu/track-${ti}`}
                        aspect="aspect-[4/3]"
                      />
                      <Input placeholder="Titre (T-shirt, carte de visite…)" className="h-8 text-xs" value={m.title || ""} onChange={(e) => { const n = [...it.items]; n[i] = { ...n[i], title: e.target.value }; updateContent(["inSitu", "tracks", ti, "items"], n); }} />
                      <Input placeholder="Légende" className="h-8 text-xs" value={m.caption || ""} onChange={(e) => { const n = [...it.items]; n[i] = { ...n[i], caption: e.target.value }; updateContent(["inSitu", "tracks", ti, "items"], n); }} />
                      <Button size="sm" variant="ghost" className="w-full" onClick={() => updateContent(["inSitu", "tracks", ti, "items"], it.items.filter((_: any, j: number) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
                      </Button>
                    </Card>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => updateContent(["inSitu", "tracks", ti, "items"], [...it.items, { url: "" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un mockup
                </Button>
              </SectionCard>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() => updateContent(["inSitu", "tracks"], [...c.inSitu.tracks, emptyInSituTrack(`Piste ${c.inSitu.tracks.length + 1}`)])}
          >
            <Plus className="h-4 w-4 mr-1" /> Ajouter une piste « En action »
          </Button>
        </TabsContent>

        <TabsContent value="livraison" className="space-y-4">
          <LogoDeliveryTab row={row} onUpdated={async () => {
            const { data } = await supabase.from("logo_presentations" as any).select("*").eq("id", row.id).single();
            if (data) { const r = data as any; r.content = ensureContent(r.content); setRow(r); }
          }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LogoDeliveryTab({ row, onUpdated }: { row: any; onUpdated: () => void }) {
  const [uploading, setUploading] = useState(false);
  const deliverables: { name: string; path: string }[] = row.deliverables ?? [];

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next = [...deliverables];
      for (const file of Array.from(files)) {
        const path = `${row.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("logo-deliverables").upload(path, file);
        if (error) { toast.error(error.message); continue; }
        next.push({ name: file.name, path });
      }
      const { error } = await supabase.from("logo_presentations" as any)
        .update({ deliverables: next }).eq("id", row.id);
      if (error) toast.error(error.message);
      else { toast.success("Fichier(s) ajouté(s)"); onUpdated(); }
    } finally {
      setUploading(false);
    }
  };

  const remove = async (path: string) => {
    await supabase.storage.from("logo-deliverables").remove([path]);
    const next = deliverables.filter((d) => d.path !== path);
    const { error } = await supabase.from("logo_presentations" as any)
      .update({ deliverables: next }).eq("id", row.id);
    if (error) return toast.error(error.message);
    onUpdated();
  };

  const download = async (path: string) => {
    const { data } = await supabase.storage.from("logo-deliverables").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <DeliveryGateCard
        entityType="logo_presentation"
        table="logo_presentations"
        row={row}
        onUpdated={onUpdated}
      />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold">Pack de fichiers livrés</h2>
          <label className="cursor-pointer">
            <input type="file" multiple className="hidden" disabled={uploading}
              onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border hover:bg-secondary">
              <Upload className="h-3.5 w-3.5" /> {uploading ? "Envoi…" : "Ajouter des fichiers"}
            </span>
          </label>
        </div>
        {deliverables.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4">
            Dépose ici les fichiers sources, vectoriels, exports… que le client pourra télécharger une fois le paiement validé.
          </div>
        ) : (
          <div className="space-y-1">
            {deliverables.map((d) => (
              <div key={d.path} className="flex items-center justify-between text-sm p-2 rounded hover:bg-secondary/60">
                <span className="truncate">{d.name}</span>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => download(d.path)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(d.path)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}