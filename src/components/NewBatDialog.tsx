import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText } from "lucide-react";
import { toast } from "sonner";

type Task = {
  id: string;
  title?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  bat_id?: string | null;
};

type Props = {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (batId: string) => void;
};

export default function NewBatDialog({ task, open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    reference: "",
    quantity: "",
    format: "",
    support: "",
    finitions: "",
    colors: "",
    observations: "",
  });

  useEffect(() => {
    if (open && task) {
      setForm((f) => ({ ...f, title: task.title ?? "" }));
      setFile(null);
    }
  }, [open, task?.id]);

  const create = async () => {
    if (!task) return;
    if (!task.client_id) return toast.error("Cette tâche n'a pas de client — impossible de créer un BAT");
    if (!form.title.trim()) return toast.error("Titre requis");
    if (file && file.type !== "application/pdf") return toast.error("Le fichier doit être un PDF");
    if (file && file.size > 50 * 1024 * 1024) return toast.error("Fichier trop volumineux (50 Mo max)");

    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from("bats").insert({
        title: form.title.trim(),
        reference: form.reference.trim() || null,
        client_id: task.client_id,
        project_id: task.project_id || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        format: form.format.trim() || null,
        support: form.support.trim() || null,
        finitions: form.finitions.trim() || null,
        colors: form.colors.trim() || null,
        observations: form.observations.trim() || null,
      }).select().single();
      if (error || !inserted) { toast.error(error?.message ?? "Erreur"); return; }

      if (file) {
        const path = `${inserted.client_id}/${inserted.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("bat").upload(path, file, { upsert: false, contentType: "application/pdf" });
        if (upErr) toast.error(`BAT créé mais upload échoué : ${upErr.message}`);
        else await supabase.from("bats").update({ file_path: path, file_uploaded_at: new Date().toISOString() }).eq("id", inserted.id);
      }

      await supabase.from("tasks").update({ bat_id: inserted.id } as any).eq("id", task.id);
      toast.success("BAT créé");
      onCreated?.(inserted.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau Bon à Tirer</DialogTitle>
          <DialogDescription>
            Renseigne les infos d'impression et joins le PDF du BAT. Tu pourras le modifier ensuite.
          </DialogDescription>
        </DialogHeader>

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
            <Label className="text-xs">Format</Label>
            <Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="A4, A5…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Support</Label>
            <Input value={form.support} onChange={(e) => setForm({ ...form, support: e.target.value })} placeholder="Couché 170g…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Couleurs</Label>
            <Input value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="Quadri R°/V°" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Finitions</Label>
            <Input value={form.finitions} onChange={(e) => setForm({ ...form, finitions: e.target.value })} placeholder="Pelliculage mat…" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Observations</Label>
            <Textarea rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Fichier BAT (PDF)</Label>
            <div className="flex items-center gap-2">
              <input
                id="new-bat-file"
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button asChild type="button" size="sm" variant="outline">
                <label htmlFor="new-bat-file" className="cursor-pointer">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {file ? "Changer le fichier" : "Sélectionner un PDF"}
                </label>
              </Button>
              {file && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                  <FileText className="h-3 w-3" /> {file.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={create} disabled={saving}>
            {saving ? "Création…" : "Créer le BAT"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}