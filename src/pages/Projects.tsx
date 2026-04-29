import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PROJECT_TYPE_LABEL } from "@/lib/format";

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", client_id: "", type: "autre", description: "" });

  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from("projects").select("id,name,type,description,clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    setProjects(p.data ?? []);
    setClients(c.data ?? []);
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

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Projets"
        description={`${projects.length} projet${projects.length > 1 ? "s" : ""}`}
        actions={
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
        }
      />
      {clients.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Crée d'abord un client pour pouvoir créer un projet.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {projects.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Aucun projet</div>
          ) : (
            <div className="divide-y">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projets/${p.id}`}
                  className="grid grid-cols-12 gap-3 px-5 py-3 hover:bg-secondary/40 items-center text-sm"
                >
                  <div className="col-span-6 truncate font-medium">{p.name}</div>
                  <div className="col-span-4 text-muted-foreground truncate">{p.clients?.name ?? "—"}</div>
                  <div className="col-span-2 text-xs text-muted-foreground truncate">{PROJECT_TYPE_LABEL[p.type]}</div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}