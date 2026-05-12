import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Palette, Trash2, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { emptyLogoPresentationContent } from "@/data/logo-presentations/empty";

type Row = {
  id: string;
  project_name: string;
  client_name: string;
  client_id: string | null;
  version: string;
  is_published: boolean;
  share_token: string | null;
  updated_at: string;
  content: any;
  tagline: string;
  clients?: { name: string } | null;
};

export default function LogoPresentations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Row[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_name: "", client_id: "" });

  const load = async () => {
    const [s, c] = await Promise.all([
      supabase.from("logo_presentations" as any).select("*, clients(name)").order("updated_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    if (s.data) setItems(s.data as any);
    if (c.data) setClients(c.data);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.project_name.trim()) { toast.error("Nom du projet requis"); return; }
    if (!form.client_id) { toast.error("Client requis"); return; }
    const client = clients.find((c) => c.id === form.client_id);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      project_name: form.project_name.trim(),
      client_name: client?.name ?? "",
      client_id: form.client_id,
      tagline: "",
      content: { ...emptyLogoPresentationContent },
      created_by: u.user?.id,
    };
    const { data, error } = await supabase.from("logo_presentations" as any).insert(payload).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Présentation créée");
    setOpen(false);
    setForm({ project_name: "", client_id: "" });
    navigate(`/logo/${(data as any).id}`);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("logo_presentations" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Présentation supprimée");
    load();
  };

  const duplicate = async (row: Row) => {
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      project_name: `${row.project_name} (copie)`,
      client_name: row.client_name,
      client_id: row.client_id,
      version: row.version,
      tagline: row.tagline,
      content: row.content,
      created_by: u.user?.id,
    };
    const { data, error } = await supabase.from("logo_presentations" as any).insert(payload).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Présentation dupliquée");
    navigate(`/logo/${(data as any).id}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Présentations de logo"
        description="Pistes et propositions de logo pour vos clients"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nouvelle présentation</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle présentation de logo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nom du projet</Label>
                  <Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                    placeholder="Pistes logo — Ascension Élagage" />
                </div>
                <div>
                  <Label>Client</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir un client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={create}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 mt-6">
        {items.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Aucune présentation de logo. Créez la première.
          </Card>
        )}
        {items.map((s) => (
          <Card key={s.id} className="p-4 flex items-center gap-4">
            <Palette className="h-5 w-5 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <Link to={`/logo/${s.id}`} className="font-medium hover:underline truncate block">
                {s.project_name}
              </Link>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {s.clients?.name ?? s.client_name} · {s.version}
              </div>
            </div>
            {s.is_published && s.share_token && (
              <Button variant="ghost" size="sm" asChild>
                <a href={`/p/logo/${s.share_token}`} target="_blank" rel="noreferrer" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Lien public
                </a>
              </Button>
            )}
            <Badge variant={s.is_published ? "default" : "outline"}>
              {s.is_published ? "Publiée" : "Brouillon"}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => duplicate(s)} title="Dupliquer">
              <Copy className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette présentation ?</AlertDialogTitle>
                  <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove(s.id)}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        ))}
      </div>
    </div>
  );
}