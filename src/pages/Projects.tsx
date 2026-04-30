import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Copy, Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PROJECT_TYPE_LABEL } from "@/lib/format";

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", client_id: "", type: "autre", description: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from("projects").select("id,name,type,description,client_id,archived,clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    setProjects(p.data ?? []);
    setClients(c.data ?? []);
    setSelected(new Set());
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    if (!form.client_id) return toast.error("Client requis");
    const { error } = await supabase.from("projects").insert({
      name: form.name.trim(),
      client_id: form.client_id,
      type: form.type as any,
      description: form.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Projet créé");
    setForm({ name: "", client_id: "", type: "autre", description: "" });
    setOpen(false);
    load();
  };

  const visibleProjects = projects.filter((p) => showArchived ? p.archived : !p.archived);
  const allVisibleSelected = visibleProjects.length > 0 && visibleProjects.every((p) => selected.has(p.id));

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(visibleProjects.map((p) => p.id)));
  };

  const bulkArchive = async (archived: boolean) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("projects").update({ archived }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(archived ? `${ids.length} projet(s) archivé(s)` : `${ids.length} projet(s) restauré(s)`);
    load();
  };

  const bulkDuplicate = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const toDup = projects.filter((p) => ids.includes(p.id));
    const rows = toDup.map((p) => ({
      name: `${p.name} (copie)`,
      client_id: p.client_id,
      type: p.type,
      description: p.description ?? null,
    }));
    const { error } = await supabase.from("projects").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} projet(s) dupliqué(s)`);
    load();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("projects").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} projet(s) supprimé(s)`);
    setConfirmDelete(false);
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Projets"
        description={`${visibleProjects.length} projet${visibleProjects.length > 1 ? "s" : ""}${showArchived ? " archivé(s)" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Voir actifs" : "Voir archivés"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={clients.length === 0}><Plus className="h-4 w-4 mr-1" /> Nouveau projet</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau projet</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROJECT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        }
      />
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2 rounded-md border bg-secondary/40">
          <span className="text-sm font-medium">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={bulkDuplicate}>
            <Copy className="h-4 w-4 mr-1" /> Dupliquer
          </Button>
          {showArchived ? (
            <Button size="sm" variant="outline" onClick={() => bulkArchive(false)}>
              <ArchiveRestore className="h-4 w-4 mr-1" /> Restaurer
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => bulkArchive(true)}>
              <Archive className="h-4 w-4 mr-1" /> Archiver
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Supprimer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {clients.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Crée d'abord un client pour pouvoir créer un projet.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {visibleProjects.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Aucun projet</div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 gap-3 px-5 py-2 items-center text-xs text-muted-foreground bg-secondary/30">
                <div className="col-span-6 flex items-center gap-3">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
                  <span>Nom</span>
                </div>
                <div className="col-span-4">Client</div>
                <div className="col-span-2">Type</div>
              </div>
              {visibleProjects.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm hover:bg-secondary/40 ${checked ? "bg-secondary/30" : ""}`}
                  >
                    <div className="col-span-6 flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(p.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Link to={`/projets/${p.id}`} className="truncate font-medium hover:underline">
                        {p.name}
                      </Link>
                    </div>
                    <div className="col-span-4 text-muted-foreground truncate">{p.clients?.name ?? "—"}</div>
                    <div className="col-span-2 text-xs text-muted-foreground truncate">{PROJECT_TYPE_LABEL[p.type]}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selected.size} projet{selected.size > 1 ? "s" : ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Les tâches et bons de commande liés seront détachés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}