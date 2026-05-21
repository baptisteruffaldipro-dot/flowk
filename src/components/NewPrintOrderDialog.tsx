import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { computeTaskBilling } from "@/lib/billing";
import { Upload, Loader2, Sparkles } from "lucide-react";
import PrintProductsEditor, { PrintProduct } from "@/components/PrintProductsEditor";

type Task = {
  id: string;
  title?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  billing_type?: string | null;
  flat_amount?: number | null;
  hourly_rate?: number | null;
  total_minutes?: number | null;
};

type Props = {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (printOrderId: string) => void;
};

export default function NewPrintOrderDialog({ task, open, onOpenChange, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsingNote, setParsingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [products, setProducts] = useState<PrintProduct[]>([]);
  const [form, setForm] = useState({
    description: "",
    reference: "",
    quantity: "",
    format: "",
    support: "",
    grammage: "",
    colors: "",
    finitions: "",
    observations: "",
    amount: "",
    estimated_delivery_date: "",
  });

  useEffect(() => {
    if (open && task) {
      const billing = computeTaskBilling(task as any);
      const amt = task.billing_type === "forfait" ? (task.flat_amount ?? 0) : (billing.total ?? 0);
      setForm({
        description: task.title ?? "",
        reference: "",
        quantity: "",
        format: "",
        support: "",
        grammage: "",
        colors: "",
        finitions: "",
        observations: "",
        amount: amt > 0 ? String(amt) : "",
        estimated_delivery_date: "",
      });
      setProducts([]);
      setNoteText("");
    }
  }, [open, task?.id]);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const applyParsed = (data: any) => {
    setForm((prev) => ({
      ...prev,
      description: data.description ?? prev.description,
      reference: data.reference ?? prev.reference,
      quantity: data.quantity != null ? String(data.quantity) : prev.quantity,
      format: data.format ?? prev.format,
      grammage: data.grammage ?? prev.grammage,
      support: data.support ?? prev.support,
      colors: data.colors ?? prev.colors,
      finitions: data.finitions ?? prev.finitions,
      observations: data.observations ?? prev.observations,
      amount: data.amount != null ? String(data.amount) : prev.amount,
    }));
    const extras = Array.isArray(data.products) ? data.products.slice(1) : [];
    if (extras.length > 0) {
      setProducts(extras.map((p: any) => ({
        description: p.description ?? "",
        quantity: p.quantity != null ? String(p.quantity) : "",
        format: p.format ?? "",
        support: p.support ?? "",
        finitions: p.finitions ?? "",
        amount: p.amount != null ? String(p.amount) : "",
      })));
    }
    return extras.length;
  };

  const handleScreenshotUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 5);
    if (imgs.length === 0) return toast.error("Sélectionnez une image");
    setParsing(true);
    try {
      const images = await Promise.all(imgs.map(fileToDataUrl));
      const { data, error } = await supabase.functions.invoke("parse-print-order", { body: { images } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const extras = applyParsed(data);
      toast.success(extras > 0 ? `${extras + 1} produits détectés` : "Champs remplis depuis la capture");
    } catch (e: any) {
      toast.error(e?.message ?? "Analyse impossible");
    } finally {
      setParsing(false);
    }
  };

  const parseNote = async () => {
    const text = noteText.trim();
    if (!text) return toast.error("Saisis une note d'abord");
    setParsingNote(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-print-order", { body: { text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const extras = applyParsed(data);
      toast.success(extras > 0 ? `${extras + 1} produits détectés` : "Champs remplis depuis la note");
    } catch (e: any) {
      toast.error(e?.message ?? "Analyse impossible");
    } finally {
      setParsingNote(false);
    }
  };

  const create = async () => {
    if (!task) return;
    if (!task.client_id) return toast.error("Cette tâche n'a pas de client — impossible de créer une commande");
    if (!form.description.trim()) return toast.error("Description requise");

    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from("print_orders").insert({
        description: form.description.trim(),
        client_id: task.client_id,
        project_id: task.project_id || null,
        amount: form.amount ? Number(form.amount) : null,
        status: "a_commander",
        reference: form.reference.trim() || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        format: form.format.trim() || null,
        grammage: form.grammage.trim() || null,
        support: form.support.trim() || null,
        colors: form.colors.trim() || null,
        finitions: form.finitions.trim() || null,
        observations: form.observations.trim() || null,
        estimated_delivery_date: form.estimated_delivery_date || null,
        products: products as any,
      }).select().single();
      if (error || !inserted) { toast.error(error?.message ?? "Erreur"); return; }

      toast.success("Commande d'impression créée");
      onCreated?.(inserted.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle commande d'impression</DialogTitle>
          <DialogDescription>
            Crée une commande d'impression liée à cette tâche. Les infos peuvent être complétées ensuite.
          </DialogDescription>
        </DialogHeader>

        <label
          className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-md cursor-pointer transition mb-3 ${parsing ? "opacity-60 pointer-events-none" : "hover:bg-secondary/50 hover:border-primary/40"}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleScreenshotUpload(e.dataTransfer.files); }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={parsing}
            onChange={(e) => { handleScreenshotUpload(e.target.files); e.target.value = ""; }}
          />
          {parsing ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {parsing ? "Analyse de la capture…" : "Importer une capture d'écran"}
            </div>
            <div className="text-xs text-muted-foreground">
              Glisse-dépose ou clique : l'IA remplit les champs depuis ta commande imprimeur
            </div>
          </div>
        </label>

        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Note libre</Label>
            <Button type="button" size="sm" variant="outline" onClick={parseNote} disabled={parsingNote || !noteText.trim()}>
              {parsingNote ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Générer
            </Button>
          </div>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Décris la commande en quelques mots (ex : 500 cartes de visite 85x55mm quadri R°/V°, couché mat 350g, pelliculage soft touch, livraison sous 7j, 120€)…"
            rows={2}
          />
          <p className="text-xs text-muted-foreground">L'IA analyse ta note et remplit automatiquement les champs ci-dessous.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Description *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Référence</Label>
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={50} />
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
            <Label className="text-xs">Grammage</Label>
            <Input value={form.grammage} onChange={(e) => setForm({ ...form, grammage: e.target.value })} placeholder="170g…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Support</Label>
            <Input value={form.support} onChange={(e) => setForm({ ...form, support: e.target.value })} placeholder="Couché brillant…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Couleurs</Label>
            <Input value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="Quadri R°/V°" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Finitions</Label>
            <Input value={form.finitions} onChange={(e) => setForm({ ...form, finitions: e.target.value })} placeholder="Pelliculage mat…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Montant (€ HT)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Livraison estimée</Label>
            <Input type="date" value={form.estimated_delivery_date} onChange={(e) => setForm({ ...form, estimated_delivery_date: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Observations</Label>
            <Textarea rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Produits additionnels</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Ajoutez d'autres produits regroupés dans cette même commande (ex : flyers + cartes + affiches).
          </p>
          <PrintProductsEditor value={products} onChange={setProducts} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={create} disabled={saving}>
            {saving ? "Création…" : "Créer la commande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}