import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { PROJECT_TYPE_LABEL, fmtDate } from "@/lib/format";
import ClientSelectField from "@/components/ClientSelectField";
import { PROJECT_TASK_TEMPLATES } from "@/lib/projectTaskTemplates";

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", client_id: "", type: "autre", description: "", deadline: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from("projects").select("id,name,type,description,client_id,archived,deadline,created_at,clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    setProjects(p.data ?? []);
    setClients(c.data ?? []);
    setSelected(new Set());
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const prefillName = searchParams.get("name") ?? "";
      setForm((f) => ({ ...f, name: prefillName }));
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new"); next.delete("name");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    if (!form.client_id) return toast.error("Client requis");
    const { data: created, error } = await supabase.from("projects").insert({
      name: form.name.trim(),
      client_id: form.client_id,
      type: form.type as any,
      description: form.description || null,
      deadline: form.deadline || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    // Auto-créer les sous-tâches selon le type de projet
    const template = PROJECT_TASK_TEMPLATES[form.type];
    if (created?.id && template) {
      const rows = template.map((title, idx) => ({
        title,
        project_id: created.id,
        client_id: form.client_id,
        status: "a_faire" as const,
        position: idx,
      }));
      await supabase.from("tasks").insert(rows);
    }
    toast.success("Projet créé");
    setForm({ name: "", client_id: "", type: "autre", description: "", deadline: "" });
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
      deadline: p.deadline ?? null,
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
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouveau projet</Button>
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
                  <ClientSelectField
                    value={form.client_id}
                    onChange={(client_id) => setForm({ ...form, client_id })}
                    clients={clients}
                    placeholder="Sélectionner"
                    onClientCreated={(client) => {
                      setClients((current) => [client, ...current]);
                      setForm((current) => ({ ...current, client_id: client.id }));
                    }}
                  />
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Date de livraison annoncée</Label>
                  <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
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
      <Card className="overflow-hidden">
          {visibleProjects.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Aucun projet</div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 gap-3 px-5 py-2 items-center text-xs text-muted-foreground bg-secondary/30">
                <div className="col-span-5 flex items-center gap-3">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
                  <span>Nom</span>
                </div>
                <div className="col-span-3">Client</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-1">Créé</div>
                <div className="col-span-1">Livraison</div>
              </div>
              {visibleProjects.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm hover:bg-secondary/40 ${checked ? "bg-secondary/30" : ""}`}
                  >
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(p.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Link to={`/projets/${p.id}`} className="truncate font-medium hover:underline">
                        {p.name}
                      </Link>
                    </div>
                    <div className="col-span-3 text-muted-foreground truncate">{p.clients?.name ?? "—"}</div>
                    <div className="col-span-2 text-xs text-muted-foreground truncate">{PROJECT_TYPE_LABEL[p.type]}</div>
                    <div className="col-span-1 text-xs text-muted-foreground">{fmtDate(p.created_at)}</div>
                    <div className="col-span-1 text-xs text-muted-foreground">{fmtDate(p.deadline)}</div>
                  </div>
                );
              })}
            </div>
          )}
      </Card>

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