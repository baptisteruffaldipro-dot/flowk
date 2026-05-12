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
import { Plus, Trash2, Eye, Save, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import LogoPresentationView from "@/components/logo-presentation/LogoPresentationView";
import ImageUpload from "@/components/logo-presentation/ImageUpload";
import RichTextEditor from "@/components/logo-presentation/RichTextEditor";
import type { LogoPresentation, LogoVariant } from "@/data/logo-presentations/types";
import { emptyLogoPresentationContent } from "@/data/logo-presentations/empty";

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
  c.moodboard = { ...emptyLogoPresentationContent.moodboard, ...(c.moodboard || {}) };
  c.logos = {
    ...emptyLogoPresentationContent.logos,
    ...(c.logos || {}),
    primary: { ...emptyLogoPresentationContent.logos.primary, ...((c.logos || {}).primary || {}) },
    secondary: { ...emptyLogoPresentationContent.logos.secondary, ...((c.logos || {}).secondary || {}) },
    submark: { ...emptyLogoPresentationContent.logos.submark, ...((c.logos || {}).submark || {}) },
  };
  c.colors = { ...emptyLogoPresentationContent.colors, ...(c.colors || {}) };
  c.typography = { ...emptyLogoPresentationContent.typography, ...(c.typography || {}) };
  c.inSitu = { ...emptyLogoPresentationContent.inSitu, ...(c.inSitu || {}) };
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

  const update = useCallback(<K extends keyof DBRow>(key: K, value: DBRow[K]) => {
    setRow((r) => r ? { ...r, [key]: value } : r);
  }, []);

  const updateContent = useCallback((path: string[], value: any) => {
    setRow((r) => {
      if (!r) return r;
      const content = JSON.parse(JSON.stringify(r.content));
      let cur = content;
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
      cur[path[path.length - 1]] = value;
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
          </div>
        )}
      </Card>

      <Tabs defaultValue="meta" className="mt-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="meta">En-tête</TabsTrigger>
          <TabsTrigger value="brief">Brief</TabsTrigger>
          <TabsTrigger value="moodboard">Moodboard</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
          <TabsTrigger value="colors">Couleurs</TabsTrigger>
          <TabsTrigger value="typo">Typographies</TabsTrigger>
          <TabsTrigger value="insitu">En action</TabsTrigger>
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

        <TabsContent value="moodboard">
          <SectionCard title="02 — Moodboard">
            <div><Label>Intro</Label><RichTextEditor value={c.moodboard.intro} onChange={(html) => updateContent(["moodboard", "intro"], html)} /></div>
            <div>
              <Label>Mots-clés</Label>
              <StringList value={c.moodboard.keywords} onChange={(v) => updateContent(["moodboard", "keywords"], v)} placeholder="Mot-clé" />
            </div>
            <div>
              <Label>Références / Inspirations</Label>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                {c.moodboard.images.map((img: any, i: number) => (
                  <Card key={i} className="p-3 space-y-2 bg-muted/20">
                    <ImageUpload
                      value={img.url}
                      onChange={(url) => {
                        const n = [...c.moodboard.images]; n[i] = { ...n[i], url }; updateContent(["moodboard", "images"], n);
                      }}
                      folder={`${folder}/moodboard`}
                      aspect="aspect-square"
                    />
                    <Input
                      placeholder="Légende"
                      className="h-8 text-xs"
                      value={img.caption || ""}
                      onChange={(e) => {
                        const n = [...c.moodboard.images]; n[i] = { ...n[i], caption: e.target.value }; updateContent(["moodboard", "images"], n);
                      }}
                    />
                    <Button size="sm" variant="ghost" className="w-full" onClick={() => updateContent(["moodboard", "images"], c.moodboard.images.filter((_: any, j: number) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
                    </Button>
                  </Card>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => updateContent(["moodboard", "images"], [...c.moodboard.images, { url: "" }])}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter une référence
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="logos" className="space-y-4">
          <SectionCard title="03 — Pistes de logo (intro)">
            <RichTextEditor value={c.logos.intro} onChange={(html) => updateContent(["logos", "intro"], html)} />
          </SectionCard>
          <SectionCard title="Logo principal (primaire)">
            <VariantEditor
              variant={c.logos.primary}
              onChange={(v) => updateContent(["logos", "primary"], v)}
              folder={`${folder}/logos/primary`}
            />
          </SectionCard>
          <SectionCard title="Logo secondaire">
            <VariantEditor
              variant={c.logos.secondary}
              onChange={(v) => updateContent(["logos", "secondary"], v)}
              folder={`${folder}/logos/secondary`}
            />
          </SectionCard>
          <SectionCard title="Submark (tertiaire)">
            <VariantEditor
              variant={c.logos.submark}
              onChange={(v) => updateContent(["logos", "submark"], v)}
              folder={`${folder}/logos/submark`}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="colors">
          <SectionCard title="04 — Palette de couleurs">
            <div><Label>Intro</Label><RichTextEditor value={c.colors.intro} onChange={(html) => updateContent(["colors", "intro"], html)} /></div>
            <div className="space-y-2">
              <Label>Couleurs</Label>
              {c.colors.palette.map((col: any, i: number) => (
                <Card key={i} className="p-3 grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_2fr_auto] gap-2 items-center bg-muted/20">
                  <input
                    type="color"
                    value={col.hex || "#000000"}
                    onChange={(e) => { const n = [...c.colors.palette]; n[i] = { ...n[i], hex: e.target.value }; updateContent(["colors", "palette"], n); }}
                    className="h-10 w-12 rounded cursor-pointer"
                  />
                  <Input placeholder="Nom (Vert pomme)" value={col.name} onChange={(e) => { const n = [...c.colors.palette]; n[i] = { ...n[i], name: e.target.value }; updateContent(["colors", "palette"], n); }} />
                  <Input placeholder="#9BCA3E" value={col.hex} onChange={(e) => { const n = [...c.colors.palette]; n[i] = { ...n[i], hex: e.target.value }; updateContent(["colors", "palette"], n); }} />
                  <Input placeholder="Usage" value={col.usage} onChange={(e) => { const n = [...c.colors.palette]; n[i] = { ...n[i], usage: e.target.value }; updateContent(["colors", "palette"], n); }} />
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["colors", "palette"], c.colors.palette.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
              <Button size="sm" variant="outline" onClick={() => updateContent(["colors", "palette"], [...c.colors.palette, { name: "", hex: "#000000", usage: "" }])}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter une couleur
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="typo">
          <SectionCard title="05 — Typographies">
            <div><Label>Intro</Label><Textarea rows={3} value={c.typography.intro} onChange={(e) => updateContent(["typography", "intro"], e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Polices</Label>
              {c.typography.fonts.map((f: any, i: number) => (
                <Card key={i} className="p-3 space-y-2 bg-muted/20">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Rôle (Principale)" value={f.role} onChange={(e) => { const n = [...c.typography.fonts]; n[i] = { ...n[i], role: e.target.value }; updateContent(["typography", "fonts"], n); }} />
                    <Input placeholder="Nom (GC Grind)" value={f.name} onChange={(e) => { const n = [...c.typography.fonts]; n[i] = { ...n[i], name: e.target.value }; updateContent(["typography", "fonts"], n); }} />
                  </div>
                  <Input placeholder="Échantillon (Aa Bb Cc)" value={f.sample} onChange={(e) => { const n = [...c.typography.fonts]; n[i] = { ...n[i], sample: e.target.value }; updateContent(["typography", "fonts"], n); }} />
                  <Input placeholder="Usage" value={f.usage} onChange={(e) => { const n = [...c.typography.fonts]; n[i] = { ...n[i], usage: e.target.value }; updateContent(["typography", "fonts"], n); }} />
                  <Button size="sm" variant="ghost" onClick={() => updateContent(["typography", "fonts"], c.typography.fonts.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4 mr-1" /> Retirer
                  </Button>
                </Card>
              ))}
              <Button size="sm" variant="outline" onClick={() => updateContent(["typography", "fonts"], [...c.typography.fonts, { role: "", name: "", sample: "Aa Bb", usage: "" }])}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter une police
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="insitu">
          <SectionCard title="06 — En action (mockups)">
            <div><Label>Intro</Label><RichTextEditor value={c.inSitu.intro} onChange={(html) => updateContent(["inSitu", "intro"], html)} /></div>
            <div>
              <Label>Mises en situation</Label>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                {c.inSitu.items.map((it: any, i: number) => (
                  <Card key={i} className="p-3 space-y-2 bg-muted/20">
                    <ImageUpload
                      value={it.url}
                      onChange={(url) => { const n = [...c.inSitu.items]; n[i] = { ...n[i], url }; updateContent(["inSitu", "items"], n); }}
                      folder={`${folder}/insitu`}
                      aspect="aspect-[4/3]"
                    />
                    <Input placeholder="Titre (T-shirt, carte de visite…)" className="h-8 text-xs" value={it.title || ""} onChange={(e) => { const n = [...c.inSitu.items]; n[i] = { ...n[i], title: e.target.value }; updateContent(["inSitu", "items"], n); }} />
                    <Input placeholder="Légende" className="h-8 text-xs" value={it.caption || ""} onChange={(e) => { const n = [...c.inSitu.items]; n[i] = { ...n[i], caption: e.target.value }; updateContent(["inSitu", "items"], n); }} />
                    <Button size="sm" variant="ghost" className="w-full" onClick={() => updateContent(["inSitu", "items"], c.inSitu.items.filter((_: any, j: number) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
                    </Button>
                  </Card>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => updateContent(["inSitu", "items"], [...c.inSitu.items, { url: "" }])}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter un mockup
              </Button>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}