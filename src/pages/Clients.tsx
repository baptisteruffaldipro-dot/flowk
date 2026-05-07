import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, X, Merge, Loader2 } from "lucide-react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { detectDuplicatePlan, executeMergePlan, type MergePlan } from "@/lib/mergeDuplicates";

type Client = { id: string; name: string; company: string | null; email: string | null; phone: string | null };

const schema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
}).refine((d) => (d.name && d.name.length > 0) || (d.company && d.company.length > 0), {
  message: "Société ou contact requis",
  path: ["company"],
});

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", address: "", notes: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mergePlan, setMergePlan] = useState<MergePlan | null>(null);
  const [merging, setMerging] = useState(false);
  const [scanningMerge, setScanningMerge] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await supabase.from("clients").select("id,name,company,email,phone").order("name");
    setClients((data as any) ?? []);
    setSelected(new Set());
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const finalName = (parsed.data.name && parsed.data.name.trim()) || (parsed.data.company as string).trim();
    const { error } = await supabase.from("clients").insert({
      name: finalName,
      company: parsed.data.company || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Client ajouté");
    setForm({ name: "", company: "", email: "", phone: "", address: "", notes: "" });
    setOpen(false);
    load();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => (prev.size === clients.length ? new Set() : new Set(clients.map((c) => c.id))));
  };

  const deleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    try {
      // Vérifier rattachements (projets, tâches, commandes, factures, BAT, RDV, questionnaires)
      const checks = await Promise.all([
        supabase.from("projects").select("client_id").in("client_id", ids),
        supabase.from("tasks").select("client_id").in("client_id", ids),
        supabase.from("print_orders").select("client_id").in("client_id", ids),
        supabase.from("invoices").select("client_id").in("client_id", ids),
        supabase.from("bats").select("client_id").in("client_id", ids),
        supabase.from("appointments").select("client_id").in("client_id", ids),
        supabase.from("questionnaires").select("client_id").in("client_id", ids),
      ]);
      const blocked = new Set<string>();
      checks.forEach((r) => (r.data ?? []).forEach((row: any) => row.client_id && blocked.add(row.client_id)));
      const deletable = ids.filter((id) => !blocked.has(id));
      if (deletable.length === 0) {
        toast.error("Impossible : ces clients ont des projets, tâches ou commandes associés.");
        setConfirmDelete(false);
        setDeleting(false);
        return;
      }
      const { error } = await supabase.from("clients").delete().in("id", deletable);
      if (error) throw error;
      const skipped = ids.length - deletable.length;
      toast.success(
        `${deletable.length} client${deletable.length > 1 ? "s" : ""} supprimé${deletable.length > 1 ? "s" : ""}` +
          (skipped > 0 ? ` · ${skipped} ignoré${skipped > 1 ? "s" : ""} (rattachements)` : "")
      );
      setConfirmDelete(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const scanDuplicates = async () => {
    setScanningMerge(true);
    try {
      const plan = await detectDuplicatePlan();
      if (plan.length === 0) {
        toast.success("Aucun doublon détecté 🎉");
      } else {
        setMergePlan(plan);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de détection");
    } finally {
      setScanningMerge(false);
    }
  };

  const runMerge = async () => {
    if (!mergePlan) return;
    setMerging(true);
    try {
      const { merged, reassigned } = await executeMergePlan(mergePlan);
      toast.success(`${merged} doublon${merged > 1 ? "s" : ""} fusionné${merged > 1 ? "s" : ""} · ${reassigned} liaison${reassigned > 1 ? "s" : ""} réassignée${reassigned > 1 ? "s" : ""}`);
      setMergePlan(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de fusion");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Clients"
        description={`${clients.length} client${clients.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={scanDuplicates} disabled={scanningMerge}>
            {scanningMerge ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Merge className="h-4 w-4 mr-1" />}
            Fusionner doublons
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouveau client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Field label="Société *"><Input autoFocus value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
                <Field label="Contact"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                </div>
                <Field label="Adresse"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-md border bg-secondary/40 px-4 py-2">
          <div className="text-sm">
            <strong>{selected.size}</strong> sélectionné{selected.size > 1 ? "s" : ""}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4 mr-1" /> Annuler
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          </div>
        </div>
      )}

      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, société, email ou téléphone…"
          className="pl-9"
        />
      </div>

      {(() => {
        const q = search.trim().toLowerCase();
        const filtered = q
          ? clients.filter((c) =>
              [c.name, c.company, c.email, c.phone].some((v) => v?.toLowerCase().includes(q))
            )
          : clients;
        return (
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Aucun client. Crée ton premier client.</div>
        ) : (
          <div className="divide-y">
            <div className="flex items-center gap-3 px-5 py-2 bg-muted/30 text-xs text-muted-foreground">
              <Checkbox
                checked={selected.size > 0 && selected.size === filtered.length}
                onCheckedChange={toggleAll}
                aria-label="Tout sélectionner"
              />
              <span>Tout sélectionner</span>
            </div>
            {filtered.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-5 py-4 hover:bg-secondary/40 transition cursor-pointer"
                onClick={() => navigate(`/clients/${c.id}`)}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    aria-label={`Sélectionner ${c.name}`}
                  />
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                  </div>
                  <div className="text-sm text-muted-foreground">{c.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
        );
      })()}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selected.size} client{selected.size > 1 ? "s" : ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les clients ayant des projets, tâches, commandes ou factures associés seront ignorés.
              Cette action est irréversible pour les autres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!mergePlan} onOpenChange={(o) => !o && setMergePlan(null)}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mergePlan?.length ?? 0} groupe{(mergePlan?.length ?? 0) > 1 ? "s" : ""} de doublons détecté{(mergePlan?.length ?? 0) > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              La fiche la plus complète sera <strong>conservée</strong>. Les autres seront supprimées et leurs projets / tâches / commandes / factures / BAT / RDV / questionnaires seront transférés sur la fiche conservée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 my-2">
            {mergePlan?.map((g, i) => (
              <div key={i} className="rounded-md border p-3 text-sm">
                <div className="font-medium text-primary mb-1">✓ Conservé : {g.keep.name} {g.keep.email ? `· ${g.keep.email}` : ""}</div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {g.drop.map((d) => (
                    <div key={d.id}>✗ Supprimé : {d.name} {d.email ? `· ${d.email}` : ""} {d.phone ? `· ${d.phone}` : ""}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={runMerge} disabled={merging}>
              {merging ? "Fusion en cours..." : "Confirmer la fusion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}