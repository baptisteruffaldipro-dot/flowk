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
import { Plus, Trash2, Eye, Save, ArrowLeft, Copy, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { getPublicAppUrl } from "@/lib/publicUrl";
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

// S'assure que les nouveaux blocs existent même sur d'anciens enregistrements
const ensureContent = (raw: any) => {
  const c = { ...emptyBrandStrategyContent, ...(raw || {}) };
  // merge profond pour les blocs optionnels qui pourraient être absents
  c.visualTerritory = { ...emptyBrandStrategyContent.visualTerritory!, ...(c.visualTerritory || {}) };
  c.persona = { ...emptyBrandStrategyContent.persona!, ...(c.persona || {}) };
  c.launchPlan = { ...emptyBrandStrategyContent.launchPlan!, ...(c.launchPlan || {}) };
  c.moodboard = { ...emptyBrandStrategyContent.moodboard!, ...(c.moodboard || {}) };
  c.logoSystem = { ...emptyBrandStrategyContent.logoSystem!, ...(c.logoSystem || {}) };
  c.typography = { ...emptyBrandStrategyContent.typography!, ...(c.typography || {}) };
  c.colorPalette = { ...emptyBrandStrategyContent.colorPalette!, ...(c.colorPalette || {}) };
  c.inSitu = { ...emptyBrandStrategyContent.inSitu!, ...(c.inSitu || {}) };
  return c;
};

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
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("brand_strategies" as any).select("*").eq("id", id).single().then(({ data, error }) => {
      if (error || !data) { toast.error("Introuvable"); navigate("/strategies"); return; }
      const r = data as any;
      // garantit la présence de toutes les clés
      r.content = ensureContent(r.content);
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
    const updated = { ...row, ...next };
    setRow(updated);
    // Persist immediately so the share link is live without needing an extra Save click
    const { error } = await supabase.from("brand_strategies" as any).update({
      is_published: updated.is_published,
      share_token: updated.share_token,
    }).eq("id", updated.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(publish ? "Publié — lien actif" : "Dépublié");
  };

  const copyShareLink = () => {
    if (!row?.share_token) return;
    const url = `${window.location.origin}/p/strategie/${row.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Lien copié");
    setTimeout(() => setCopied(false), 2000);
  };

  const sendByEmail = async () => {
    if (!row?.share_token) return;
    if (!row.is_published) { toast.error("Active d'abord le lien public"); return; }
    if (!row.client_id) { toast.error("Aucun client lié à cette stratégie"); return; }
    const { data: client } = await supabase
      .from("clients")
      .select("name,email")
      .eq("id", row.client_id)
      .maybeSingle();
    if (!client?.email) { toast.error("Le client n'a pas d'email enregistré"); return; }
    setSending(true);
    const presentationUrl = `${getPublicAppUrl()}/p/strategie/${row.share_token}`;
    const { data, error } = await supabase.functions.invoke("send-app-email", {
      body: {
        templateName: "brand-strategy-ready",
        recipientEmail: client.email,
        idempotencyKey: `brand-strategy-ready-${row.id}-${Date.now()}`,
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
            <Button size="sm" onClick={sendByEmail} disabled={sending || !row.client_id}>
              <Mail className="h-4 w-4 mr-1" /> {sending ? "Envoi…" : "Envoyer par email"}
            </Button>
          </div>
        )}
      </Card>
      {row.is_published && row.share_token && (
        <p className="text-xs text-muted-foreground mt-2 px-1">
          L'email envoyé au client indique que sa stratégie de marque est disponible
          à la consultation, avec un bouton menant directement à ce lien.
        </p>
      )}

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
          <TabsTrigger value="visual">Territoire visuel</TabsTrigger>
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="launch">Plan com.</TabsTrigger>
          <TabsTrigger value="moodboard">Moodboard</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
          <TabsTrigger value="typo">Typographie</TabsTrigger>
          <TabsTrigger value="colors">Palette</TabsTrigger>
          <TabsTrigger value="insitu">In situ</TabsTrigger>
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

        {/* 11 — Territoire visuel */}
        <TabsContent value="visual">
          <SectionCard title="11 — Territoire visuel">
            <div><Label>Intro</Label><Textarea rows={3} value={c.visualTerritory.intro} onChange={(e) => updateContent(["visualTerritory", "intro"], e.target.value)} /></div>
            <div><Label>Mots-clés</Label><StringList value={c.visualTerritory.keywords} onChange={(v) => updateContent(["visualTerritory", "keywords"], v)} placeholder="Lumineux" /></div>
            <div><Label>Références</Label><StringList value={c.visualTerritory.references} onChange={(v) => updateContent(["visualTerritory", "references"], v)} placeholder="Aesop, Monocle…" /></div>
            <div><Label>Notes</Label><Textarea rows={3} value={c.visualTerritory.notes} onChange={(e) => updateContent(["visualTerritory", "notes"], e.target.value)} /></div>
          </SectionCard>
        </TabsContent>

        {/* 12 — Persona */}
        <TabsContent value="persona">
          <SectionCard title="12 — Persona affiné">
            <div><Label>Intro</Label><Textarea rows={2} value={c.persona.intro} onChange={(e) => updateContent(["persona", "intro"], e.target.value)} /></div>
            {c.persona.profiles.map((p: any, i: number) => (
              <Card key={i} className="p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Profil {i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["persona", "profiles"], c.persona.profiles.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Prénom" value={p.firstName} onChange={(e) => { const n = [...c.persona.profiles]; n[i] = { ...n[i], firstName: e.target.value }; updateContent(["persona", "profiles"], n); }} />
                  <Input placeholder="Âge" value={p.age} onChange={(e) => { const n = [...c.persona.profiles]; n[i] = { ...n[i], age: e.target.value }; updateContent(["persona", "profiles"], n); }} />
                  <Input placeholder="Rôle / métier" value={p.role} onChange={(e) => { const n = [...c.persona.profiles]; n[i] = { ...n[i], role: e.target.value }; updateContent(["persona", "profiles"], n); }} />
                </div>
                <Textarea rows={2} placeholder="Bio courte" value={p.bio} onChange={(e) => { const n = [...c.persona.profiles]; n[i] = { ...n[i], bio: e.target.value }; updateContent(["persona", "profiles"], n); }} />
                <Textarea rows={2} placeholder="Mode de vie" value={p.lifestyle} onChange={(e) => { const n = [...c.persona.profiles]; n[i] = { ...n[i], lifestyle: e.target.value }; updateContent(["persona", "profiles"], n); }} />
                <Textarea rows={2} placeholder="Attentes & besoins" value={p.needs} onChange={(e) => { const n = [...c.persona.profiles]; n[i] = { ...n[i], needs: e.target.value }; updateContent(["persona", "profiles"], n); }} />
                <Input placeholder="Citation" value={p.quote} onChange={(e) => { const n = [...c.persona.profiles]; n[i] = { ...n[i], quote: e.target.value }; updateContent(["persona", "profiles"], n); }} />
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["persona", "profiles"], [...c.persona.profiles, { firstName: "", age: "", role: "", bio: "", lifestyle: "", needs: "", quote: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Persona
            </Button>
          </SectionCard>
        </TabsContent>

        {/* 13 — Plan de communication */}
        <TabsContent value="launch">
          <SectionCard title="13 — Plan de communication lancement">
            <div><Label>Intro</Label><Textarea rows={2} value={c.launchPlan.intro} onChange={(e) => updateContent(["launchPlan", "intro"], e.target.value)} /></div>
            {c.launchPlan.phases.map((ph: any, i: number) => (
              <Card key={i} className="p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Phase {i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["launchPlan", "phases"], c.launchPlan.phases.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Titre (Pré-lancement…)" value={ph.title} onChange={(e) => { const n = [...c.launchPlan.phases]; n[i] = { ...n[i], title: e.target.value }; updateContent(["launchPlan", "phases"], n); }} />
                  <Input placeholder="Timing (J-30…)" value={ph.timing} onChange={(e) => { const n = [...c.launchPlan.phases]; n[i] = { ...n[i], timing: e.target.value }; updateContent(["launchPlan", "phases"], n); }} />
                </div>
                <Textarea rows={2} placeholder="Objectif" value={ph.objective} onChange={(e) => { const n = [...c.launchPlan.phases]; n[i] = { ...n[i], objective: e.target.value }; updateContent(["launchPlan", "phases"], n); }} />
                <div><Label className="text-xs">Actions</Label>
                  <StringList value={ph.actions} onChange={(v) => { const n = [...c.launchPlan.phases]; n[i] = { ...n[i], actions: v }; updateContent(["launchPlan", "phases"], n); }} placeholder="Teasing Instagram" />
                </div>
                <div><Label className="text-xs">Canaux</Label>
                  <StringList value={ph.channels} onChange={(v) => { const n = [...c.launchPlan.phases]; n[i] = { ...n[i], channels: v }; updateContent(["launchPlan", "phases"], n); }} placeholder="Instagram, presse locale…" />
                </div>
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["launchPlan", "phases"], [...c.launchPlan.phases, { title: "", timing: "", objective: "", actions: [], channels: [] }])}>
              <Plus className="h-4 w-4 mr-1" /> Phase
            </Button>
          </SectionCard>
        </TabsContent>

        {/* 14 — Moodboard */}
        <TabsContent value="moodboard">
          <SectionCard title="14 — Moodboard (univers à explorer)">
            <div><Label>Intro</Label><Textarea rows={2} value={c.moodboard.intro} onChange={(e) => updateContent(["moodboard", "intro"], e.target.value)} /></div>
            {c.moodboard.universes.map((u: any, i: number) => (
              <Card key={i} className="p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Univers {i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["moodboard", "universes"], c.moodboard.universes.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input placeholder="Nom de l'univers" value={u.name} onChange={(e) => { const n = [...c.moodboard.universes]; n[i] = { ...n[i], name: e.target.value }; updateContent(["moodboard", "universes"], n); }} />
                <Textarea rows={2} placeholder="Description" value={u.description} onChange={(e) => { const n = [...c.moodboard.universes]; n[i] = { ...n[i], description: e.target.value }; updateContent(["moodboard", "universes"], n); }} />
                <div><Label className="text-xs">Mots-clés</Label>
                  <StringList value={u.keywords} onChange={(v) => { const n = [...c.moodboard.universes]; n[i] = { ...n[i], keywords: v }; updateContent(["moodboard", "universes"], n); }} placeholder="Iodé" />
                </div>
                <div><Label className="text-xs">Références</Label>
                  <StringList value={u.references} onChange={(v) => { const n = [...c.moodboard.universes]; n[i] = { ...n[i], references: v }; updateContent(["moodboard", "universes"], n); }} placeholder="Hôtel du Cap, Sézane…" />
                </div>
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["moodboard", "universes"], [...c.moodboard.universes, { name: "", description: "", keywords: [], references: [] }])}>
              <Plus className="h-4 w-4 mr-1" /> Univers
            </Button>
          </SectionCard>
        </TabsContent>

        {/* 15 — Logos */}
        <TabsContent value="logos">
          <SectionCard title="15 — Système de logos">
            <div><Label>Intro</Label><Textarea rows={2} value={c.logoSystem.intro} onChange={(e) => updateContent(["logoSystem", "intro"], e.target.value)} /></div>
            {c.logoSystem.items.map((it: any, i: number) => (
              <Card key={i} className="p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Logo {i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["logoSystem", "items"], c.logoSystem.items.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Type (Principal / Secondaire / Submark)" value={it.type} onChange={(e) => { const n = [...c.logoSystem.items]; n[i] = { ...n[i], type: e.target.value }; updateContent(["logoSystem", "items"], n); }} />
                  <Input placeholder="Nom" value={it.name} onChange={(e) => { const n = [...c.logoSystem.items]; n[i] = { ...n[i], name: e.target.value }; updateContent(["logoSystem", "items"], n); }} />
                </div>
                <Input placeholder="Usage" value={it.usage} onChange={(e) => { const n = [...c.logoSystem.items]; n[i] = { ...n[i], usage: e.target.value }; updateContent(["logoSystem", "items"], n); }} />
                <Textarea rows={2} placeholder="Description" value={it.description} onChange={(e) => { const n = [...c.logoSystem.items]; n[i] = { ...n[i], description: e.target.value }; updateContent(["logoSystem", "items"], n); }} />
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["logoSystem", "items"], [...c.logoSystem.items, { type: "", name: "", usage: "", description: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Logo
            </Button>
          </SectionCard>
        </TabsContent>

        {/* 16 — Typographie */}
        <TabsContent value="typo">
          <SectionCard title="16 — Système typographique">
            <div><Label>Intro</Label><Textarea rows={2} value={c.typography.intro} onChange={(e) => updateContent(["typography", "intro"], e.target.value)} /></div>
            {c.typography.fonts.map((f: any, i: number) => (
              <Card key={i} className="p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Police {i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["typography", "fonts"], c.typography.fonts.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Rôle (Primaire / Secondaire / Soutien)" value={f.role} onChange={(e) => { const n = [...c.typography.fonts]; n[i] = { ...n[i], role: e.target.value }; updateContent(["typography", "fonts"], n); }} />
                  <Input placeholder="Nom (Cormorant Garamond)" value={f.name} onChange={(e) => { const n = [...c.typography.fonts]; n[i] = { ...n[i], name: e.target.value }; updateContent(["typography", "fonts"], n); }} />
                </div>
                <Input placeholder="Usage" value={f.usage} onChange={(e) => { const n = [...c.typography.fonts]; n[i] = { ...n[i], usage: e.target.value }; updateContent(["typography", "fonts"], n); }} />
                <Input placeholder="Échantillon affiché (Aa Bb)" value={f.sample} onChange={(e) => { const n = [...c.typography.fonts]; n[i] = { ...n[i], sample: e.target.value }; updateContent(["typography", "fonts"], n); }} />
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["typography", "fonts"], [...c.typography.fonts, { role: "", name: "", usage: "", sample: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Police
            </Button>
          </SectionCard>
        </TabsContent>

        {/* 17 — Palette chromatique */}
        <TabsContent value="colors">
          <SectionCard title="17 — Palette chromatique">
            <div><Label>Intro</Label><Textarea rows={2} value={c.colorPalette.intro} onChange={(e) => updateContent(["colorPalette", "intro"], e.target.value)} /></div>
            {(["primary", "neutrals"] as const).map((kind) => (
              <div key={kind} className="space-y-2">
                <Label className="text-xs uppercase tracking-wider">{kind === "primary" ? "Couleurs primaires" : "Neutres"}</Label>
                {c.colorPalette[kind].map((col: any, i: number) => (
                  <Card key={i} className="p-3 space-y-2 bg-muted/30">
                    <div className="flex justify-between items-center gap-2">
                      <div className="h-8 w-8 rounded border" style={{ backgroundColor: col.hex || "#fff" }} />
                      <Input placeholder="Nom" value={col.name} onChange={(e) => { const n = [...c.colorPalette[kind]]; n[i] = { ...n[i], name: e.target.value }; updateContent(["colorPalette", kind], n); }} />
                      <Input placeholder="#000000" value={col.hex} onChange={(e) => { const n = [...c.colorPalette[kind]]; n[i] = { ...n[i], hex: e.target.value }; updateContent(["colorPalette", kind], n); }} className="w-32" />
                      <Button size="icon" variant="ghost" onClick={() => updateContent(["colorPalette", kind], c.colorPalette[kind].filter((_: any, j: number) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input placeholder="Usage" value={col.usage} onChange={(e) => { const n = [...c.colorPalette[kind]]; n[i] = { ...n[i], usage: e.target.value }; updateContent(["colorPalette", kind], n); }} />
                  </Card>
                ))}
                <Button size="sm" variant="outline" onClick={() => updateContent(["colorPalette", kind], [...c.colorPalette[kind], { name: "", hex: "#000000", usage: "" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Couleur
                </Button>
              </div>
            ))}
          </SectionCard>
        </TabsContent>

        {/* 18 — In situ */}
        <TabsContent value="insitu">
          <SectionCard title="18 — Mises en situation (in situ)">
            <div><Label>Intro</Label><Textarea rows={2} value={c.inSitu.intro} onChange={(e) => updateContent(["inSitu", "intro"], e.target.value)} /></div>
            {c.inSitu.items.map((it: any, i: number) => (
              <Card key={i} className="p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Mise en situation {i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => updateContent(["inSitu", "items"], c.inSitu.items.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Titre" value={it.title} onChange={(e) => { const n = [...c.inSitu.items]; n[i] = { ...n[i], title: e.target.value }; updateContent(["inSitu", "items"], n); }} />
                  <Input placeholder="Contexte (Vitrine, packaging…)" value={it.context} onChange={(e) => { const n = [...c.inSitu.items]; n[i] = { ...n[i], context: e.target.value }; updateContent(["inSitu", "items"], n); }} />
                </div>
                <Textarea rows={3} placeholder="Description" value={it.description} onChange={(e) => { const n = [...c.inSitu.items]; n[i] = { ...n[i], description: e.target.value }; updateContent(["inSitu", "items"], n); }} />
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => updateContent(["inSitu", "items"], [...c.inSitu.items, { title: "", context: "", description: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Mise en situation
            </Button>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
