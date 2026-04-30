import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar as CalendarIcon, List, Video, MapPin, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = { visio: "Visio", presentiel: "Présentiel", telephone: "Téléphone", autre: "Autre" };
const STATUS_LABEL: Record<string, string> = { planifie: "Planifié", confirme: "Confirmé", annule: "Annulé", termine: "Terminé" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  planifie: "outline", confirme: "default", annule: "destructive", termine: "secondary",
};
const TYPE_ICON: Record<string, any> = { visio: Video, presentiel: MapPin, telephone: Phone, autre: CalendarIcon };

const fmtDateTime = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const toLocalInput = (d?: Date) => {
  const dt = d ?? new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function Appointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [form, setForm] = useState<any>({
    title: "", start_at: toLocalInput(), duration_minutes: "60",
    type: "presentiel", status: "planifie", client_id: "", project_id: "", location: "", notes: "",
  });

  const load = async () => {
    const [a, c, p] = await Promise.all([
      supabase.from("appointments").select("*, clients(name), projects(name)").order("start_at", { ascending: true }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("projects").select("id,name,client_id").order("name"),
    ]);
    if (a.error) toast.error(a.error.message);
    setAppointments(a.data ?? []);
    setClients(c.data ?? []);
    setProjects(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openCreate = (preset?: Date) => {
    setEditing(null);
    setForm({
      title: "", start_at: toLocalInput(preset), duration_minutes: "60",
      type: "presentiel", status: "planifie", client_id: "", project_id: "", location: "", notes: "",
    });
    setOpen(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      title: a.title,
      start_at: toLocalInput(new Date(a.start_at)),
      duration_minutes: String(a.duration_minutes),
      type: a.type,
      status: a.status,
      client_id: a.client_id ?? "",
      project_id: a.project_id ?? "",
      location: a.location ?? "",
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    if (!form.start_at) return toast.error("Date requise");
    const payload = {
      title: form.title.trim(),
      start_at: new Date(form.start_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      type: form.type,
      status: form.status,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("appointments").update(payload).eq("id", editing.id)
      : await supabase.from("appointments").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Rendez-vous mis à jour" : "Rendez-vous créé");
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    setOpen(false);
    load();
  };

  const filteredProjects = projects.filter((p) => !form.client_id || p.client_id === form.client_id);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: appointments.filter((a) => new Date(a.start_at).getTime() >= now),
      past: appointments.filter((a) => new Date(a.start_at).getTime() < now).reverse(),
    };
  }, [appointments]);

  // Calendar grid
  const calendarCells = useMemo(() => {
    const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday=0
    const start = new Date(first);
    start.setDate(start.getDate() - startWeekday);
    const cells: { date: Date; inMonth: boolean; items: any[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const items = appointments.filter((a) => {
        const ad = new Date(a.start_at);
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth() && ad.getDate() === d.getDate();
      });
      cells.push({ date: d, inMonth: d.getMonth() === calMonth.getMonth(), items });
    }
    return cells;
  }, [calMonth, appointments]);

  const renderRow = (a: any) => {
    const Icon = TYPE_ICON[a.type] ?? CalendarIcon;
    return (
      <button key={a.id} onClick={() => openEdit(a)} className="w-full grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm hover:bg-secondary/40 text-left">
        <div className="col-span-3 flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-xs">
            <div className="font-medium">{fmtDateTime(a.start_at)}</div>
            <div className="text-muted-foreground">{a.duration_minutes} min</div>
          </div>
        </div>
        <div className="col-span-4 min-w-0">
          <div className="font-medium truncate">{a.title}</div>
          <div className="text-xs text-muted-foreground truncate">
            {a.clients?.name ?? "—"}{a.projects?.name ? ` · ${a.projects.name}` : ""}
          </div>
        </div>
        <div className="col-span-2 text-xs text-muted-foreground truncate">{a.location ?? "—"}</div>
        <div className="col-span-1 text-xs text-muted-foreground">{TYPE_LABEL[a.type]}</div>
        <div className="col-span-2">
          <Badge variant={STATUS_VARIANT[a.status]} className="text-[10px]">{STATUS_LABEL[a.status]}</Badge>
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Rendez-vous"
        description={`${upcoming.length} à venir · ${past.length} passé${past.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-card p-0.5">
              <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} className="h-7 px-2" onClick={() => setView("list")}>
                <List className="h-4 w-4" />
              </Button>
              <Button size="sm" variant={view === "calendar" ? "secondary" : "ghost"} className="h-7 px-2" onClick={() => setView("calendar")}>
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" onClick={() => openCreate()}><Plus className="h-4 w-4 mr-1" /> Nouveau RDV</Button>
          </div>
        }
      />

      {view === "list" ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">À venir</h2>
            <Card className="overflow-hidden">
              {upcoming.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Aucun rendez-vous à venir</div>
              ) : <div className="divide-y">{upcoming.map(renderRow)}</div>}
            </Card>
          </div>
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Passés</h2>
              <Card className="overflow-hidden opacity-75"><div className="divide-y">{past.map(renderRow)}</div></Card>
            </div>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <Button variant="ghost" size="sm" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="font-semibold">{MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}</div>
            <Button variant="ghost" size="sm" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 border-b text-xs text-muted-foreground">
            {DAY_NAMES.map((d) => <div key={d} className="px-2 py-1.5 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, i) => {
              const isToday = cell.date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[100px] border-r border-b p-1.5 text-xs",
                    !cell.inMonth && "bg-muted/30 text-muted-foreground",
                    (i + 1) % 7 === 0 && "border-r-0",
                  )}
                >
                  <button
                    className={cn("text-[11px] font-medium mb-1 px-1.5 py-0.5 rounded hover:bg-secondary", isToday && "bg-primary text-primary-foreground hover:bg-primary/90")}
                    onClick={() => { const d = new Date(cell.date); d.setHours(9, 0, 0, 0); openCreate(d); }}
                  >
                    {cell.date.getDate()}
                  </button>
                  <div className="space-y-0.5">
                    {cell.items.slice(0, 3).map((a) => (
                      <button key={a.id} onClick={() => openEdit(a)} className="w-full text-left truncate px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-[10px]">
                        <span className="font-medium">{fmtTime(a.start_at)}</span> {a.title}
                      </button>
                    ))}
                    {cell.items.length > 3 && <div className="text-[10px] text-muted-foreground px-1.5">+{cell.items.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date & heure *</Label>
              <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Durée (min)</Label>
              <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Statut</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client</Label>
              <Select value={form.client_id || "_none"} onValueChange={(v) => setForm({ ...form, client_id: v === "_none" ? "" : v, project_id: "" })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Aucun —</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Projet</Label>
              <Select value={form.project_id || "_none"} onValueChange={(v) => setForm({ ...form, project_id: v === "_none" ? "" : v })} disabled={!form.client_id}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Aucun —</SelectItem>
                  {filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Lieu / lien visio</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Adresse, salle, lien Meet…" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>{editing && <Button variant="destructive" size="sm" onClick={remove}>Supprimer</Button>}</div>
            <Button onClick={save}>{editing ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
