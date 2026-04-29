import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { BAT_STATUS_LABEL, fmtDate } from "@/lib/format";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  brouillon: "outline",
  en_relecture: "secondary",
  valide: "default",
  rejete: "destructive",
};

export default function Bats() {
  const [bats, setBats] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<any>({
    title: "",
    reference: "",
    client_id: "",
    project_id: "",
    quantity: "",
    format: "",
    support: "",
    finitions: "",
    colors: "",
    observations: "",
  });

  const load = async () => {
    const [b, c, p] = await Promise.all([
      supabase.from("bats").select("*, clients(name), projects(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("projects").select("id,name,client_id").order("name"),
    ]);
    setBats(b.data ?? []);
    setClients(c.data ?? []);
    setProjects(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    if (!form.client_id) return toast.error("Client requis");
    if (file && file.type !== "application/pdf") return toast.error("Le fichier doit être un PDF");
    if (file && file.size > 50 * 1024 * 1024) return toast.error("Fichier trop volumineux (50 Mo max)");
    setUploading(true);
    const { data: inserted, error } = await supabase.from("bats").insert({
      title: form.title.trim(),
      reference: form.reference.trim() || null,
      client_id: form.client_id,
      project_id: form.project_id || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      format: form.format.trim() || null,
      support: form.support.trim() || null,
      finitions: form.finitions.trim() || null,
      colors: form.colors.trim() || null,
      observations: form.observations.trim() || null,
    }).select().single();
    if (error || !inserted) { setUploading(false); return toast.error(error?.message ?? "Erreur"); }
    if (file) {
      const path = `${inserted.client_id}/${inserted.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("bat").upload(path, file, { upsert: false, contentType: "application/pdf" });
      if (upErr) {
        setUploading(false);
        toast.error(`BAT créé mais upload échoué : ${upErr.message}`);
      } else {
        await supabase.from("bats").update({ file_path: path, file_uploaded_at: new Date().toISOString() }).eq("id", inserted.id);
      }
    }
    setUploading(false);
    toast.success("BAT créé");
    setForm({ title: "", reference: "", client_id: "", project_id: "", quantity: "", format: "", support: "", finitions: "", colors: "", observations: "" });
    setFile(null);
    setOpen(false);
    load();
  };

  const filteredProjects = projects.filter((p) => !form.client_id || p.client_id === form.client_id);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="BAT"
        description={`${bats.length} bon${bats.length > 1 ? "s" : ""} à tirer`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={clients.length === 0}><Plus className="h-4 w-4 mr-1" /> Nouveau BAT</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nouveau Bon à Tirer</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Titre *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Référence</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={50} placeholder="BAT-2026-001" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantité</Label>
                  <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v, project_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Projet</Label>
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })} disabled={!form.client_id}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Format</Label>
                  <Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="A4, 100x200mm…" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Support / papier</Label>
                  <Input value={form.support} onChange={(e) => setForm({ ...form, support: e.target.value })} placeholder="Couché 300g…" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Couleurs</Label>
                  <Input value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="Quadri R°/V°" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Finitions</Label>
                  <Input value={form.finitions} onChange={(e) => setForm({ ...form, finitions: e.target.value })} placeholder="Pelliculage mat, vernis sélectif…" maxLength={150} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Observations</Label>
                  <Input value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} maxLength={500} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Fichier PDF</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    {file && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap">
                        <Upload className="h-3 w-3" />
                        {(file.size / 1024 / 1024).toFixed(2)} Mo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Optionnel — tu pourras aussi l'ajouter plus tard depuis la fiche du BAT.</p>
                </div>
              </div>
              <DialogFooter><Button onClick={create} disabled={uploading}>{uploading ? "Création…" : "Créer"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="overflow-hidden">
        {bats.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Aucun BAT. Crée ton premier Bon à Tirer pour le faire valider par le client.
          </div>
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-12 gap-3 px-5 py-2 text-xs text-muted-foreground bg-secondary/30">
              <div className="col-span-5">Titre</div>
              <div className="col-span-3">Client / Projet</div>
              <div className="col-span-2">Statut</div>
              <div className="col-span-2">Créé le</div>
            </div>
            {bats.map((b) => (
              <Link key={b.id} to={`/bats/${b.id}`} className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm hover:bg-secondary/40">
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.title}</div>
                    {b.reference && <div className="text-xs text-muted-foreground truncate">{b.reference}</div>}
                  </div>
                </div>
                <div className="col-span-3 truncate text-muted-foreground">
                  {b.clients?.name ?? "—"}
                  {b.projects?.name && <span className="text-xs"> · {b.projects.name}</span>}
                </div>
                <div className="col-span-2">
                  <Badge variant={STATUS_VARIANT[b.status] ?? "outline"} className="text-[10px]">
                    {BAT_STATUS_LABEL[b.status]}
                  </Badge>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">{fmtDate(b.created_at)}</div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}