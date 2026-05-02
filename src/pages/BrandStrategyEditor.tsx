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
import { Plus, Trash2, Eye, Save, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import BrandStrategyView from "@/components/brand-strategy/BrandStrategyView";
import type { BrandStrategy } from "@/data/brand-strategies/types";
import { emptyBrandStrategyContent } from "@/data/brand-strategies/empty";

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

const buildStrategy = (row: DBRow): BrandStrategy => ({
  slug: row.id,
  client: row.client_name,
  projectName: row.project_name,
  version: row.version,
  tagline: row.tagline,
  ...emptyBrandStrategyContent,
  ...(row.content || {}),
});

// ========== Petits helpers UI ==========
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

export default function BrandStrategyEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<DBRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("brand_strategies" as any).select("*").eq("id", id).single().then(({ data, error }) => {
      if (error || !data) { toast.error("Introuvable"); navigate("/strategies"); return; }
      const r = data as any;
      // garantit la présence de toutes les clés
      r.content = { ...emptyBrandStrategyContent, ...(r.content || {}) };
      setRow(r);
    });
  }, [id, navigate]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase.from("brand_strategies" as any).update({
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
    setRow({ ...row, ...next });
  };

  const copyShareLink = () => {
    if (!row?.share_token) return;
    const url = `${window.location.origin}/p/strategie/${row.share_token}`;
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
        <BrandStrategyView strategy={buildStrategy(row)} />
      </div>
    );
  }

  const c = row.content;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32">
      <PageHeader
        title={row.project_name || "Stratégie de marque"}
        description={row.client_name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/strategies")}>
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

      {/* Publication */}
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
              {window.location.origin}/p/strategie/{row.share_token}
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
          <TabsTrigger value="positioning">Positionnement</TabsTrigger>
          <TabsTrigger value="signature">Signature</TabsTrigger>
          <TabsTrigger value="story">Storytelling</TabsTrigger>
          <TabsTrigger value="pillars">Piliers</TabsTrigger>
          <TabsTrigger value="moments">Moments</TabsTrigger>
          <TabsTrigger value="voice">Voix</TabsTrigger>
          <TabsTrigger value="swot">SWOT</TabsTrigger>
          <TabsTrigger value="naming">Naming</TabsTrigger>
          <TabsTrigger value="todo">À construire</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-4">
          <SectionCard title="En-tête du document">
            <div><Label>Nom du projet</Label><Input value={row.project_name} onChange={(e) => update("project_name", e.target.value)} /></div>
            <div><Label>Nom du client (affiché)</Label><Input value={row.client_name} onChange={(e) => update("client_name", e.target.value)} /></div>
            <div><Label>Version</Label><Input value={row.version} onChange={(e) => update("version", e.target.value)} /></div>
            <div><Label>Tagline (hero)</Label><Textarea value={row.tagline} onChange={(e) => update("tagline", e.target.value)} rows={2} /></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="positioning">
          <SectionCard title="01 — Positionnement">
            <Textarea rows={4} value={c.positioning} onChange={(e) => updateContent(["positioning"], e.target.value)} />
          </SectionCard>
          <SectionCard title="02 — Promesse client">
            <div><Label>Headline</Label><Input value={c.promise.headline} onChange={(e) => updateContent(["promise", "headline"], e.target.value)} /></div>
            <div><Label>Le client avant</Label><Textarea rows={3} value={c.promise.before} onChange={(e) => updateContent(["promise", "before"], e.target.value)} /></div>
            <div><Label>Le client après</Label><Textarea rows={3} value={c.promise.after} onChange={(e) => updateContent(["promise", "after"], e.target.value)} /></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="signature">
          <SectionCard title="03 — Signature & fil de communication">
            <div><Label>Signature</Label><Input value={c.signature.signature} onChange={(e) => updateContent(["signature", "signature"], e.target.value)} /></div>
            <div><Label>Fil de communication</Label><Input value={c.signature.thread} onChange={(e) => updateContent(["signature", "thread"], e.target.value)} /></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="story">
          <SectionCard title="04 — Storytelling">
            <div><Label>Titre</Label><Input value={c.storytelling.title} onChange={(e) => updateContent(["storytelling", "title"], e.target.value)} /></div>
            <div>
              <Label>Paragraphes</Label>
              <div className="space-y-2">
                {c.storytelling.paragraphs.map((p: string, i: number) => (
                  <div key={i} className="flex gap-2">
                    <Textarea rows={4} value={p} onChange={(e) => {
                      const n = [...c.storytelling.paragraphs]; n[i] = e.target.value;
                      updateContent(["storytelling", "paragraphs"], n);
                    }} />
                    <Button size="icon" variant="ghost" onClick={() => updateContent(["storytelling", "paragraphs"], c.storytelling.paragraphs.filter((_: any, j: number) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => updateContent(["storytelling", "paragraphs"], [...c.storytelling.paragraphs, ""])}>
                  <Plus className="h-4 w-4 mr-1" /> Paragraphe
                </Button>
              </div>
            </div>
            <div><Label>Citation (pull quote)</Label><Input value={c.storytelling.pullQuote} onChange={(e) => updateContent(["storytelling", "pullQuote"], e.target.value)} /></div>
            <div><Label>Ce qu'on raconte</Label><Input value={c.storytelling.proof.tells} onChange={(e) => updateContent(["storytelling", "proof", "tells"], e.target.value)} /></div>
            <div><Label>Ce que ça prouve</Label><Input value={c.storytelling.proof.proves} onChange={(e) => updateContent(["storytelling", "proof", "proves"], e.target.value)} /></div>
            <div><Label>Où l'utiliser</Label><Input value={c.storytelling.proof.useFor} onChange={(e) => updateContent(["storytelling", "proof", "useFor"], e.target.value)} /></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="pillars">
          <SectionCard title="05 — Piliers">
            {c.pillars.map((p: any, i: number) => (
              <Card key={i} className="p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Pilier {i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["pillars"], c.pillars.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input placeholder="Nom" value={p.name} onChange={(e) => { const n = [...c.pillars]; n[i] = { ...n[i], name: e.target.value }; updateContent(["pillars"], n); }} />
                <Textarea rows={2} placeholder="Description" value={p.description} onChange={(e) => { const n = [...c.pillars]; n[i] = { ...n[i], description: e.target.value }; updateContent(["pillars"], n); }} />
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["pillars"], [...c.pillars, { name: "", description: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Pilier
            </Button>
          </SectionCard>
        </TabsContent>

        <TabsContent value="moments">
          <SectionCard title="06 — Moments signature">
            {c.signatureMoments.map((m: any, i: number) => (
              <Card key={i} className="p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Moment {i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["signatureMoments"], c.signatureMoments.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Index (01)" value={m.index} onChange={(e) => { const n = [...c.signatureMoments]; n[i] = { ...n[i], index: e.target.value }; updateContent(["signatureMoments"], n); }} />
                  <Input placeholder="Quand (Été...)" value={m.when} onChange={(e) => { const n = [...c.signatureMoments]; n[i] = { ...n[i], when: e.target.value }; updateContent(["signatureMoments"], n); }} />
                </div>
                <Input placeholder="Titre" value={m.title} onChange={(e) => { const n = [...c.signatureMoments]; n[i] = { ...n[i], title: e.target.value }; updateContent(["signatureMoments"], n); }} />
                <Textarea rows={2} placeholder="Intro" value={m.intro} onChange={(e) => { const n = [...c.signatureMoments]; n[i] = { ...n[i], intro: e.target.value }; updateContent(["signatureMoments"], n); }} />
                <Textarea rows={2} placeholder="Citation" value={m.quote} onChange={(e) => { const n = [...c.signatureMoments]; n[i] = { ...n[i], quote: e.target.value }; updateContent(["signatureMoments"], n); }} />
                <Textarea rows={2} placeholder="Ce que le client vit" value={m.lives} onChange={(e) => { const n = [...c.signatureMoments]; n[i] = { ...n[i], lives: e.target.value }; updateContent(["signatureMoments"], n); }} />
                <Textarea rows={2} placeholder="Ce qu'il raconte" value={m.tells} onChange={(e) => { const n = [...c.signatureMoments]; n[i] = { ...n[i], tells: e.target.value }; updateContent(["signatureMoments"], n); }} />
                <Textarea rows={2} placeholder="Rôle stratégique" value={m.role} onChange={(e) => { const n = [...c.signatureMoments]; n[i] = { ...n[i], role: e.target.value }; updateContent(["signatureMoments"], n); }} />
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["signatureMoments"], [...c.signatureMoments, { index: String(c.signatureMoments.length + 1).padStart(2, "0"), title: "", when: "", intro: "", lives: "", tells: "", role: "", quote: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Moment
            </Button>
          </SectionCard>
        </TabsContent>

        <TabsContent value="voice">
          <SectionCard title="07 — Voix de marque">
            <div>
              <Label>La marque est</Label>
              <StringList value={c.voice.is} onChange={(v) => updateContent(["voice", "is"], v)} placeholder="Chaleureuse" />
            </div>
            <div>
              <Label>Ce qu'on refuse d'être</Label>
              <StringList value={c.voice.isNot} onChange={(v) => updateContent(["voice", "isNot"], v)} placeholder="Snack de bord de mer" />
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="swot">
          {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((k) => {
            const labels = { strengths: "Forces", weaknesses: "Faiblesses", opportunities: "Opportunités", threats: "Menaces" };
            return (
              <SectionCard key={k} title={`08 — ${labels[k]}`}>
                {c.swot[k].map((it: any, i: number) => (
                  <Card key={i} className="p-3 space-y-2 bg-muted/30">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">#{i + 1}</span>
                      <Button size="icon" variant="ghost" onClick={() => updateContent(["swot", k], c.swot[k].filter((_: any, j: number) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input placeholder="Titre" value={it.title} onChange={(e) => { const n = [...c.swot[k]]; n[i] = { ...n[i], title: e.target.value }; updateContent(["swot", k], n); }} />
                    <Textarea rows={2} placeholder="Détail" value={it.detail} onChange={(e) => { const n = [...c.swot[k]]; n[i] = { ...n[i], detail: e.target.value }; updateContent(["swot", k], n); }} />
                  </Card>
                ))}
                <Button size="sm" variant="outline" onClick={() => updateContent(["swot", k], [...c.swot[k], { title: "", detail: "" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              </SectionCard>
            );
          })}
        </TabsContent>

        <TabsContent value="naming">
          <SectionCard title="09 — Naming">
            <div><Label>Intro</Label><Input value={c.naming.intro} onChange={(e) => updateContent(["naming", "intro"], e.target.value)} /></div>
            {c.naming.strategies.map((s: any, si: number) => (
              <Card key={si} className="p-4 space-y-3 bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Stratégie {s.code}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["naming", "strategies"], c.naming.strategies.filter((_: any, j: number) => j !== si))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Code (A)" value={s.code} onChange={(e) => { const n = [...c.naming.strategies]; n[si] = { ...n[si], code: e.target.value }; updateContent(["naming", "strategies"], n); }} />
                  <Input placeholder="Titre" value={s.title} onChange={(e) => { const n = [...c.naming.strategies]; n[si] = { ...n[si], title: e.target.value }; updateContent(["naming", "strategies"], n); }} />
                </div>
                <Textarea rows={2} placeholder="Description" value={s.description} onChange={(e) => { const n = [...c.naming.strategies]; n[si] = { ...n[si], description: e.target.value }; updateContent(["naming", "strategies"], n); }} />

                <div>
                  <Label className="text-xs">Directions</Label>
                  {s.directions.map((d: any, di: number) => (
                    <Card key={di} className="p-3 space-y-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Direction {di + 1}</span>
                        <Button size="icon" variant="ghost" onClick={() => {
                          const n = [...c.naming.strategies];
                          n[si] = { ...n[si], directions: s.directions.filter((_: any, j: number) => j !== di) };
                          updateContent(["naming", "strategies"], n);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input placeholder="Nom proposé" value={d.name} onChange={(e) => {
                        const n = [...c.naming.strategies]; const nd = [...s.directions]; nd[di] = { ...nd[di], name: e.target.value };
                        n[si] = { ...n[si], directions: nd }; updateContent(["naming", "strategies"], n);
                      }} />
                      <StringList value={d.signatures} onChange={(v) => {
                        const n = [...c.naming.strategies]; const nd = [...s.directions]; nd[di] = { ...nd[di], signatures: v };
                        n[si] = { ...n[si], directions: nd }; updateContent(["naming", "strategies"], n);
                      }} placeholder="Signature proposée" />
                    </Card>
                  ))}
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => {
                    const n = [...c.naming.strategies];
                    n[si] = { ...n[si], directions: [...s.directions, { name: "", signatures: [""] }] };
                    updateContent(["naming", "strategies"], n);
                  }}>
                    <Plus className="h-4 w-4 mr-1" /> Direction
                  </Button>
                </div>

                <div>
                  <Label className="text-xs">Pistes explorées</Label>
                  <StringList value={s.explorations} onChange={(v) => {
                    const n = [...c.naming.strategies]; n[si] = { ...n[si], explorations: v };
                    updateContent(["naming", "strategies"], n);
                  }} placeholder="Garden Time" />
                </div>
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["naming", "strategies"], [...c.naming.strategies, { code: String.fromCharCode(65 + c.naming.strategies.length), title: "", description: "", directions: [{ name: "", signatures: [""] }], explorations: [] }])}>
              <Plus className="h-4 w-4 mr-1" /> Stratégie de naming
            </Button>
          </SectionCard>
        </TabsContent>

        <TabsContent value="todo">
          <SectionCard title="10 — À construire prochainement">
            <StringList value={c.todo} onChange={(v) => updateContent(["todo"], v)} placeholder="Naming final" />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
