import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABEL, PRESTATION_LABEL, PRIORITY_LABEL, PRIORITY_COLOR, STATUS_META, tagColor, fmtDate, fmtMinutes } from "@/lib/format";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

const STATUSES = ["a_faire", "aujourdhui", "envoye", "a_facturer", "archive"] as const;
type Status = typeof STATUSES[number];

function KanbanCard({ task }: { task: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const projectName = task.projects?.name ?? task.title;
  const showPrestation = !!task.projects?.name;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="touch-none"
    >
      <Link to={`/taches/${task.id}`} onClick={(e) => isDragging && e.preventDefault()}>
        <Card className="p-4 bg-card/95 hover:bg-card border border-border/60 hover:border-foreground/20 shadow-sm transition cursor-grab active:cursor-grabbing rounded-lg">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-base leading-none mt-0.5">📄</span>
            <div className="text-[15px] font-semibold leading-snug text-foreground flex-1">
              {projectName}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.clients?.name && (
              <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 ${tagColor(task.clients.name)}`}>
                {task.clients.name}
              </Badge>
            )}
            {showPrestation && (
              <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 ${tagColor(task.prestation)}`}>
                {PRESTATION_LABEL[task.prestation] ?? "Autre"}
              </Badge>
            )}
            {task.priority && task.priority !== "secondaire" && (
              <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 ${PRIORITY_COLOR[task.priority]}`}>
                {PRIORITY_LABEL[task.priority]}
              </Badge>
            )}
          </div>
        </Card>
      </Link>
    </div>
  );
}

function KanbanColumn({ status, tasks }: { status: Status; tasks: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl overflow-hidden ${meta.bg} ring-1 ${meta.ring} transition ${isOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className={`h-1 w-full ${meta.accent}`} />
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-base leading-none">{meta.emoji}</span>
          <span className="text-sm font-semibold text-foreground flex-1 truncate">{STATUS_LABEL[status]}</span>
          <span className={`text-xs font-semibold tabular-nums ${meta.count}`}>{tasks.length}</span>
        </div>
        <div className="space-y-2 min-h-[80px]">
          {tasks.map((t) => (
            <KanbanCard key={t.id} task={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [form, setForm] = useState<any>({
    title: "", client_id: "", project_id: "", prestation: "creation", priority: "secondaire",
    deadline: "", billing_type: "horaire", hourly_rate: "", flat_amount: "", estimated_minutes: "",
  });

  const load = async () => {
    const [t, c, p] = await Promise.all([
      supabase.from("tasks").select("*, clients(name), projects(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("projects").select("id,name,client_id"),
    ]);
    setTasks(t.data ?? []);
    setClients(c.data ?? []);
    setProjects(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = String(over.id) as Status;
    if (!STATUSES.includes(newStatus)) return;
    const task = tasks.find((t) => t.id === String(active.id));
    if (!task || task.status === newStatus) return;
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === String(active.id) ? { ...t, status: newStatus } : t)));
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", String(active.id));
    if (error) {
      toast.error(error.message);
      setTasks(prev);
    }
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const create = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    const payload: any = {
      title: form.title.trim(),
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      prestation: form.prestation,
      priority: form.priority,
      deadline: form.deadline || null,
      billing_type: form.billing_type,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      flat_amount: form.flat_amount ? Number(form.flat_amount) : null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : 0,
    };
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Tâche créée");
    setOpen(false);
    setForm({ title: "", client_id: "", project_id: "", prestation: "creation", priority: "secondaire", deadline: "", billing_type: "horaire", hourly_rate: "", flat_amount: "", estimated_minutes: "" });
    load();
  };

  const filteredProjects = projects.filter((p) => !form.client_id || p.client_id === form.client_id);

  return (
    <div className="p-8">
      <PageHeader
        title="Tâches"
        description={`${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouvelle tâche</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nouvelle tâche</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Titre *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Client</Label>
                    <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v, project_id: "" })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prestation</Label>
                    <Select value={form.prestation} onValueChange={(v) => setForm({ ...form, prestation: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRESTATION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Priorité</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Deadline</Label>
                  <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Facturation</Label>
                    <Select value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="horaire">Horaire</SelectItem>
                        <SelectItem value="forfait">Forfait</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.billing_type === "horaire" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Taux/h (€)</Label>
                      <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Forfait (€)</Label>
                      <Input type="number" step="0.01" value={form.flat_amount} onChange={(e) => setForm({ ...form, flat_amount: e.target.value })} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Estim. (min)</Label>
                    <Input type="number" value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card className="overflow-hidden">
            {tasks.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">Aucune tâche</div>
            ) : (
              <div className="divide-y">
                {tasks.map((t) => (
                  <Link key={t.id} to={`/taches/${t.id}`} className="grid grid-cols-12 gap-3 px-5 py-3 hover:bg-secondary/40 items-center text-sm">
                    <div className="col-span-5 truncate font-medium">{t.projects?.name ?? t.title}</div>
                    <div className="col-span-2 text-muted-foreground truncate">{t.clients?.name ?? "—"}</div>
                    <div className="col-span-1 text-muted-foreground text-xs">{PRESTATION_LABEL[t.prestation]}</div>
                    <div className="col-span-2">
                      {t.priority && t.priority !== "secondaire" && (
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLOR[t.priority]}`}>
                          {PRIORITY_LABEL[t.priority]}
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-1 text-muted-foreground text-xs flex items-center gap-1">
                      {t.deadline && <Calendar className="h-3 w-3" />}{fmtDate(t.deadline)}
                    </div>
                    <div className="col-span-1"><Badge variant="outline" className="text-[10px]">{STATUS_LABEL[t.status]}</Badge></div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
              {STATUSES.map((s) => (
                <KanbanColumn key={s} status={s} tasks={tasks.filter((t) => t.status === s)} />
              ))}
            </div>
            <DragOverlay>
              {activeTask ? (
                <Card className="p-4 shadow-2xl cursor-grabbing rotate-2 border border-border">
                  <div className="text-[15px] font-semibold leading-snug mb-2">
                    {activeTask.projects?.name ?? activeTask.title}
                  </div>
                  {activeTask.clients?.name && (
                    <Badge variant="outline" className={`text-[11px] ${tagColor(activeTask.clients.name)}`}>
                      {activeTask.clients.name}
                    </Badge>
                  )}
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>
      </Tabs>
    </div>
  );
}