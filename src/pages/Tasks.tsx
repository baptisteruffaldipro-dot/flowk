import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Plus, Calendar, Tag, GripVertical, Trash2, Search, X, CheckCircle2, FileText, Printer, Archive, UserPlus, AlertTriangle, Zap, FolderPlus, Star, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABEL, PRESTATION_LABEL, PRIORITY_LABEL, PRIORITY_COLOR, STATUS_META, tagColor, fmtDate, fmtMinutes, fmtMoney } from "@/lib/format";
import { computeTaskBudget } from "@/lib/budget";
import { computePriorityScore, priorityScoreColor, isColumnSaturated, WIP_LIMITS, detectMultipleDeliverables } from "@/lib/priority";
import NewBatDialog from "@/components/NewBatDialog";
import NewPrintOrderDialog from "@/components/NewPrintOrderDialog";
import SocialTasksAggregate from "@/components/SocialTasksAggregate";
import {
  DndContext,
  CollisionDetection,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

const STATUSES = ["a_faire", "aujourdhui", "envoye", "bat", "impression", "a_facturer", "archive"] as const;
type Status = typeof STATUSES[number];

const SOCIAL_STATUS_TO_KANBAN: Record<string, Status> = {
  a_faire: "a_faire",
  en_cours: "aujourdhui",
  fait: "archive",
  aujourdhui: "aujourdhui",
  envoye: "envoye",
  bat: "bat",
  impression: "impression",
  a_facturer: "a_facturer",
  archive: "archive",
};

const SOCIAL_PRIORITY_LABEL: Record<string, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
};
const SOCIAL_PRIORITY_COLOR: Record<string, string> = {
  basse: "bg-slate-100 text-slate-700 border-slate-300",
  normale: "bg-blue-100 text-blue-700 border-blue-300",
  haute: "bg-red-100 text-red-700 border-red-300",
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  qualifie: "Qualifié",
  converti: "Converti",
  perdu: "Perdu",
};

const leadKanbanStatus = (lead: any): Status => {
  const status = lead.metadata?.kanban_status;
  return STATUSES.includes(status) ? status : "a_faire";
};

const isKanbanStatus = (value: string): value is Status => STATUSES.includes(value as Status);

const positionForInsertIndex = (sorted: { pos: number }[], insertIndex: number) => {
  const before = sorted[insertIndex - 1];
  const after = sorted[insertIndex];
  if (!before && !after) return 10;
  if (!before) return after.pos - 5;
  if (!after) return before.pos + 10;
  return (before.pos + after.pos) / 2;
};

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
};

const statusFromDropTarget = (overId: string, tasks: any[], dividers: any[], socialTasks: any[] = [], leads: any[] = []): Status | null => {
  if (overId.startsWith("slot:")) {
    const status = overId.split(":")[1];
    return isKanbanStatus(status) ? status : null;
  }
  if (overId.startsWith("divider:")) {
    const divider = dividers.find((d) => d.id === overId.slice("divider:".length));
    return divider && isKanbanStatus(divider.status) ? divider.status : null;
  }
  if (overId.startsWith("task:")) {
    const task = tasks.find((t) => t.id === overId.slice("task:".length));
    return task && isKanbanStatus(task.status) ? task.status : null;
  }
  if (overId.startsWith("social-card:")) {
    const task = socialTasks.find((t) => t.id === overId.slice("social-card:".length));
    const status = task ? SOCIAL_STATUS_TO_KANBAN[task.status] : null;
    return status ?? null;
  }
  if (overId.startsWith("lead-card:")) {
    const lead = leads.find((l) => l.id === overId.slice("lead-card:".length));
    return lead ? leadKanbanStatus(lead) : null;
  }
  return isKanbanStatus(overId) ? overId : null;
};

function LeadKanbanCard({ lead }: { lead: any }) {
  const navigate = useNavigate();
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `lead-card:${lead.id}` });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: `lead:${lead.id}` });
  const title = lead.name || lead.company || lead.email || lead.phone || "Nouveau lead";
  return (
    <div ref={(node) => { setDropRef(node); setDragRef(node); }} style={{ opacity: isDragging ? 0.4 : 1 }} className="touch-none group">
      <Card
        {...listeners}
        {...attributes}
        onClick={() => { if (!isDragging) navigate("/leads"); }}
        className={`p-4 bg-card/95 hover:bg-card border shadow-sm transition rounded-lg cursor-grab active:cursor-grabbing ${isOver ? "border-primary ring-1 ring-primary" : "border-border/60 hover:border-foreground/20"}`}
      >
        <div
          className="flex items-start gap-2 mb-3"
        >
          <UserPlus className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="text-[15px] font-semibold leading-snug text-foreground flex-1 min-w-0 truncate">
            {title}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 border-primary/40 bg-primary/10 text-primary">
            Lead
          </Badge>
          {lead.status && (
            <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5">
              {LEAD_STATUS_LABEL[lead.status] ?? lead.status}
            </Badge>
          )}
          {lead.source && (
            <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 ${tagColor(lead.source)}`}>
              {lead.source}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}

function SocialKanbanCard({ task }: { task: any }) {
  const navigate = useNavigate();
  const overdue = task.due_date && task.status !== "archive" && task.status !== "fait" && new Date(task.due_date) < new Date(new Date().toDateString());
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `social-card:${task.id}` });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: `social:${task.id}` });
  return (
    <div ref={(node) => { setDropRef(node); setDragRef(node); }} style={{ opacity: isDragging ? 0.4 : 1 }} className="touch-none group">
      <Card
        {...listeners}
        {...attributes}
        onClick={() => { if (!isDragging) navigate(`/social/${task.client_id}`); }}
        className={`p-4 bg-card/95 hover:bg-card border shadow-sm transition rounded-lg cursor-grab active:cursor-grabbing ${isOver ? "border-primary ring-1 ring-primary" : "border-border/60 hover:border-foreground/20"}`}
      >
        <div
          className="flex items-start gap-2 mb-3"
        >
          <span className="text-base leading-none mt-0.5">📱</span>
          <div className="text-[15px] font-semibold leading-snug text-foreground flex-1">
            {task.title}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 ${tagColor(task.clients?.name ?? "—")}`}>
            {task.clients?.name ?? "Sans client"}
          </Badge>
          <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 bg-purple-100 text-purple-700 border-purple-300">
            Réseaux sociaux
          </Badge>
          {task.priority && task.priority !== "normale" && (
            <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 ${SOCIAL_PRIORITY_COLOR[task.priority] ?? ""}`}>
              {SOCIAL_PRIORITY_LABEL[task.priority]}
            </Badge>
          )}
          {task.due_date && (
            <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 inline-flex items-center gap-1 ${overdue ? "bg-red-100 text-red-700 border-red-300" : ""}`}>
              <Calendar className="h-3 w-3" />
              {fmtDate(task.due_date)}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}

function DeadlineBadge({ value, onChange }: { value: string; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
        >
          <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 cursor-pointer hover:opacity-80 inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {fmtDate(value)}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        align="start"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-8 text-xs"
        />
        <button
          type="button"
          onClick={() => { onChange(null); setOpen(false); }}
          className="w-full text-left px-2 py-1 mt-1 text-xs rounded hover:bg-accent text-muted-foreground"
        >
          Retirer la deadline
        </button>
      </PopoverContent>
    </Popover>
  );
}

function AddStickerMenu({
  task,
  onUpdate,
}: {
  task: any;
  onUpdate: (id: string, patch: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const showPriority = !task.priority || task.priority === "secondaire";
  const showDeadline = !task.deadline;

  if (!showPriority && !showDeadline) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
          aria-label="Ajouter un sticker"
        >
          <Badge variant="outline" className="text-[11px] font-medium px-1.5 py-0.5 cursor-pointer hover:bg-accent border-dashed text-muted-foreground inline-flex items-center gap-0.5">
            <Plus className="h-3 w-3" />
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-1"
        align="start"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Ajouter</div>
        {showPriority && (
          <div className="space-y-0.5">
            {Object.entries(PRIORITY_LABEL)
              .filter(([k]) => k !== "secondaire")
              .map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { onUpdate(task.id, { priority: k }); setOpen(false); }}
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent inline-flex items-center gap-2"
                >
                  <Tag className="h-3 w-3" />
                  Priorité : {label as string}
                </button>
              ))}
          </div>
        )}
        {showDeadline && (
          <div className="px-2 py-1.5">
            <Label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Deadline
            </Label>
            <Input
              type="date"
              className="h-8 text-xs mt-1"
              onChange={(e) => {
                if (e.target.value) {
                  onUpdate(task.id, { deadline: e.target.value });
                  setOpen(false);
                }
              }}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function QuickEditBadge({
  children,
  className,
  options,
  value,
  onChange,
  searchable,
  placeholder,
}: {
  children: React.ReactNode;
  className: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  searchable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = searchable && q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
        >
          <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 cursor-pointer hover:opacity-80 ${className}`}>
            {children}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1"
        align="start"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {searchable && (
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder ?? "Rechercher…"}
            className="h-8 mb-1 text-xs"
            autoFocus
          />
        )}
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent ${value === o.value ? "bg-accent/60 font-medium" : ""}`}
            >
              {o.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Aucun résultat</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KanbanCard({
  task,
  clients,
  onUpdate,
  paid,
  onComplete,
}: {
  task: any;
  clients: { id: string; name: string }[];
  onUpdate: (id: string, patch: any) => void;
  paid?: boolean;
  onComplete: (task: any, action: "bat" | "print" | "archive") => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `task:${task.id}` });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: task.id });
  const navigate = useNavigate();
  const projectName = task.title?.trim() ? task.title : (task.projects?.name ?? "Sans titre");
  const showPrestation = !!task.projects?.name;
  const budget = computeTaskBudget(task);
  const noBudget = budget.hasNoEstimate;
  return (
    <div
      ref={(node) => { setDropRef(node); setDragRef(node); }}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="touch-none group"
    >
      <Card
        {...listeners}
        {...attributes}
        onClick={() => { if (!isDragging) navigate(`/taches/${task.id}`); }}
        className={`p-4 bg-card/95 hover:bg-card border shadow-sm transition rounded-lg cursor-grab active:cursor-grabbing ${
          isOver
            ? "border-primary ring-1 ring-primary"
            : "border-border/60 hover:border-foreground/20"
        }`}
      >
        <div
          className="flex items-start gap-2 mb-3"
        >
          <span className="text-base leading-none mt-0.5">📄</span>
          <div className="text-[15px] font-semibold leading-snug text-foreground flex-1">
            {projectName}
            {task.has_unread_client_activity && (
              <span title="Nouvelle activité client" className="inline-block ml-1.5 h-2.5 w-2.5 rounded-full bg-destructive align-middle animate-pulse" />
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition shrink-0 inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold"
                title="Terminer la tâche"
              >
                <CheckCircle2 className="h-3 w-3" />
                Terminer
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <DropdownMenuLabel className="text-xs">Envoyer en…</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onComplete(task, "bat")}>
                <FileText className="h-3.5 w-3.5 mr-2" /> BAT
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onComplete(task, "print")}>
                <Printer className="h-3.5 w-3.5 mr-2" /> Impression
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onComplete(task, "archive")}>
                <Archive className="h-3.5 w-3.5 mr-2" /> Archivé
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onComplete(task, "archive")}>
                <Archive className="h-3.5 w-3.5 mr-2" /> Marquer terminée
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {paid && (
              <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 text-white px-2 py-0.5">
                Payé
              </Badge>
            )}
            <QuickEditBadge
              className={tagColor(task.clients?.name ?? "—")}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              value={task.client_id}
              onChange={(v) => onUpdate(task.id, { client_id: v })}
              searchable
              placeholder="Rechercher un client"
            >
              {task.clients?.name ?? "Sans client"}
            </QuickEditBadge>
            {(() => {
              const list: string[] = (task.prestations && task.prestations.length > 0)
                ? task.prestations
                : (task.prestation ? [task.prestation] : []);
              return list.map((k) => (
                <Badge
                  key={k}
                  variant="outline"
                  className={`text-[11px] font-medium px-2 py-0.5 ${tagColor(k)}`}
                >
                  {PRESTATION_LABEL[k] ?? k}
                </Badge>
              ));
            })()}
            {task.priority && task.priority !== "secondaire" && (
              <QuickEditBadge
                className={PRIORITY_COLOR[task.priority] ?? ""}
                options={Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label: label as string }))}
                value={task.priority}
                onChange={(v) => onUpdate(task.id, { priority: v })}
              >
                {PRIORITY_LABEL[task.priority]}
              </QuickEditBadge>
            )}
            {task.deadline && (
              <DeadlineBadge
                value={task.deadline}
                onChange={(v) => onUpdate(task.id, { deadline: v })}
              />
            )}
            <AddStickerMenu task={task} onUpdate={onUpdate} />
            {(() => {
              const score = computePriorityScore(task);
              if (score < 20) return null;
              return (
                <Badge
                  variant="outline"
                  className={`text-[11px] font-medium px-2 py-0.5 inline-flex items-center gap-0.5 ${priorityScoreColor(score)}`}
                  title="Score de priorité (deadline + priorité + CA)"
                >
                  <Star className="h-3 w-3" />
                  {score}
                </Badge>
              );
            })()}
            {(() => {
              if (noBudget) return null;
              const overrun = budget.estimatedTotal > 0 && budget.realTotal > budget.estimatedTotal;
              return (
                <BudgetEditBadge task={task} onUpdate={onUpdate}>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-semibold px-2 py-0.5 ml-auto tabular-nums inline-flex items-center gap-1 cursor-pointer ${
                      overrun
                        ? "text-red-700 dark:text-red-400 border-red-400/60 bg-red-500/10"
                        : "text-emerald-700 dark:text-emerald-400 border-emerald-300/50"
                    }`}
                    title={`Estimé ${fmtMoney(budget.estimatedTotal)} (presta ${fmtMoney(budget.estimatedPresta)} · impression ${fmtMoney(budget.estimatedPrint)}) · Réel ${fmtMoney(budget.realTotal)}`}
                  >
                    {fmtMoney(budget.estimatedTotal)}
                    {budget.realTotal > 0 && budget.realTotal !== budget.estimatedTotal && (
                      <span className="opacity-70">→ {fmtMoney(budget.realTotal)}</span>
                    )}
                  </Badge>
                </BudgetEditBadge>
              );
            })()}
          </div>
      </Card>
    </div>
  );
}

function BudgetEditBadge({
  task,
  onUpdate,
  children,
}: {
  task: any;
  onUpdate: (id: string, patch: any) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>(task.billing_type ?? "horaire");
  const [flat, setFlat] = useState<string>(task.flat_amount != null ? String(task.flat_amount) : "");
  const [rate, setRate] = useState<string>(task.hourly_rate != null ? String(task.hourly_rate) : "");
  const [minutes, setMinutes] = useState<string>(task.estimated_minutes ? String(task.estimated_minutes) : "");
  const [print, setPrint] = useState<string>(task.estimated_print_amount != null ? String(task.estimated_print_amount) : "");

  useEffect(() => {
    if (!open) return;
    setType(task.billing_type ?? "horaire");
    setFlat(task.flat_amount != null ? String(task.flat_amount) : "");
    setRate(task.hourly_rate != null ? String(task.hourly_rate) : "");
    setMinutes(task.estimated_minutes ? String(task.estimated_minutes) : "");
    setPrint(task.estimated_print_amount != null ? String(task.estimated_print_amount) : "");
  }, [open, task]);

  const save = () => {
    onUpdate(task.id, {
      billing_type: type,
      flat_amount: flat === "" ? null : Number(flat),
      hourly_rate: rate === "" ? null : Number(rate),
      estimated_minutes: minutes === "" ? 0 : Number(minutes),
      estimated_print_amount: print === "" ? null : Number(print),
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="ml-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 space-y-2"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-semibold">Budget estimé</div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="horaire">Horaire</SelectItem>
            <SelectItem value="forfait">Forfait</SelectItem>
          </SelectContent>
        </Select>
        {type === "forfait" ? (
          <Input className="h-8 text-xs" type="number" placeholder="Montant forfait (€)" value={flat} onChange={(e) => setFlat(e.target.value)} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-8 text-xs" type="number" placeholder="Taux €/h" value={rate} onChange={(e) => setRate(e.target.value)} />
            <Input className="h-8 text-xs" type="number" placeholder="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
        )}
        <Input className="h-8 text-xs" type="number" placeholder="Impression estimée (€)" value={print} onChange={(e) => setPrint(e.target.value)} />
        <Button size="sm" className="w-full h-8 text-xs" onClick={save}>Enregistrer</Button>
      </PopoverContent>
    </Popover>
  );
}

function KanbanColumn({
  status,
  tasks,
  socialTasks,
  leads,
  clients,
  onUpdate,
  dividers,
  onAddDivider,
  onUpdateDivider,
  onDeleteDivider,
  paidTaskIds,
  onQuickAdd,
  onComplete,
}: {
  status: Status;
  tasks: any[];
  socialTasks: any[];
  leads: any[];
  clients: { id: string; name: string }[];
  onUpdate: (id: string, patch: any) => void;
  dividers: any[];
  onAddDivider: (status: Status) => void;
  onUpdateDivider: (id: string, label: string) => void;
  onDeleteDivider: (id: string) => void;
  paidTaskIds: Set<string>;
  onQuickAdd: (status: Status, title: string) => Promise<void>;
  onComplete: (task: any, action: "bat" | "print" | "archive") => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const totalCount = tasks.length + socialTasks.length + leads.length;
  const saturated = isColumnSaturated(status, totalCount);
  const wipLimit = WIP_LIMITS[status];
  const submitDraft = async () => {
    const t = draft.trim();
    if (!t) { setAdding(false); return; }
    await onQuickAdd(status, t);
    setDraft("");
    setAdding(false);
  };

  // Merge tasks and dividers by position
  const items: Array<{ kind: "task"; data: any; pos: number } | { kind: "divider"; data: any; pos: number }> = [
    ...tasks.map((t) => ({ kind: "task" as const, data: t, pos: t.position ?? 0 })),
    ...dividers.map((d) => ({ kind: "divider" as const, data: d, pos: d.position ?? 0 })),
  ].sort((a, b) => a.pos - b.pos);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl overflow-hidden flex-shrink-0 w-80 ${meta.bg} ring-1 ${meta.ring} transition ${isOver ? "ring-2 ring-primary" : ""} ${saturated ? "ring-2 ring-red-400 dark:ring-red-500" : ""}`}
    >
      <div className={`h-1 w-full ${saturated ? "bg-red-400" : meta.accent}`} />
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-base leading-none">{meta.emoji}</span>
          <span className="text-sm font-semibold text-foreground flex-1 truncate">{STATUS_LABEL[status]}</span>
          {saturated && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-red-500"
              aria-label={`Colonne saturée (${totalCount}/${wipLimit})`}
            />
          )}
          <span
            className={`text-xs font-semibold tabular-nums ${saturated ? "text-red-600 dark:text-red-400" : meta.count}`}
            title={wipLimit && wipLimit !== Infinity ? `Limite recommandée : ${wipLimit}` : undefined}
          >
            {totalCount}{wipLimit && wipLimit !== Infinity ? `/${wipLimit}` : ""}
          </span>
        </div>
        <div className="space-y-1 min-h-[80px]">
          <DropSlot id={`slot:${status}:0`} />
          {items.map((it, idx) => (
            <div key={it.kind === "task" ? `t-${it.data.id}` : `d-${it.data.id}`}>
              {it.kind === "task" ? (
                <KanbanCard task={it.data} clients={clients} onUpdate={onUpdate} paid={paidTaskIds.has(it.data.id)} onComplete={onComplete} />
              ) : (
                <DividerRow
                  divider={it.data}
                  onRename={onUpdateDivider}
                  onDelete={onDeleteDivider}
                />
              )}
              <DropSlot id={`slot:${status}:${idx + 1}`} />
            </div>
          ))}
          {socialTasks.map((st) => (
            <div key={`st-${st.id}`} className="mt-1">
              <SocialKanbanCard task={st} />
            </div>
          ))}
          {leads.map((lead) => (
            <div key={`lead-${lead.id}`} className="mt-1">
              <LeadKanbanCard lead={lead} />
            </div>
          ))}
          {adding ? (
            <div className="rounded-md border bg-card p-2">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={submitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submitDraft(); }
                  if (e.key === "Escape") { setDraft(""); setAdding(false); }
                }}
                placeholder="Titre de la tâche…"
                className="h-8 text-sm"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full mt-1 py-1.5 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded inline-flex items-center justify-center gap-1 border border-dashed border-border/40"
            >
              <Plus className="h-3 w-3" /> Ajouter une tâche
            </button>
          )}
          <button
            type="button"
            onClick={() => onAddDivider(status)}
            className="w-full mt-2 py-1.5 px-2 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded inline-flex items-center justify-center gap-1 border border-dashed border-border/40"
          >
            <Plus className="h-3 w-3" /> Séparateur
          </button>
        </div>
      </div>
    </div>
  );
}

function DropSlot({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`transition-all rounded ${isOver ? "h-8 bg-primary/20 ring-1 ring-primary my-1" : "h-3"}`}
    />
  );
}

function DividerRow({
  divider,
  onRename,
  onDelete,
}: {
  divider: any;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(divider.label);
  useEffect(() => setValue(divider.label), [divider.label]);
  const { setNodeRef, isOver } = useDroppable({ id: `divider:${divider.id}` });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: `divider-drag:${divider.id}` });
  return (
    <div
      ref={(node) => { setNodeRef(node); setDragRef(node); }}
      className={`group rounded-md bg-background/40 border px-2 py-1.5 flex items-center gap-1 transition ${
        isOver ? "border-primary ring-1 ring-primary" : "border-border/40"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      {!editing && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground touch-none"
          aria-label="Déplacer le séparateur"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => { setEditing(false); if (value.trim() && value !== divider.label) onRename(divider.id, value.trim()); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
            if (e.key === "Escape") { setValue(divider.label); setEditing(false); }
          }}
          className="h-6 text-[11px] uppercase tracking-wider font-semibold"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 text-left text-[11px] uppercase tracking-wider font-semibold text-foreground/80 truncate"
        >
          {divider.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(divider.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
        aria-label="Supprimer le séparateur"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dividers, setDividers] = useState<any[]>([]);
  const [paidTaskIds, setPaidTaskIds] = useState<Set<string>>(new Set());
  const [socialTasks, setSocialTasks] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showProjectHint, setShowProjectHint] = useState(false);
  const [batForTask, setBatForTask] = useState<any | null>(null);
  const [printForTask, setPrintForTask] = useState<any | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [form, setForm] = useState<any>({
    title: "", client_id: "", project_id: "", prestation: "creation", priority: "secondaire",
    deadline: "", billing_type: "horaire", hourly_rate: "", flat_amount: "", estimated_minutes: "", estimated_print_amount: "",
  });

  const load = async () => {
    const [t, c, p, d, inv, st, l] = await Promise.all([
      supabase.from("tasks").select("*, clients(name), projects(name)").order("position", { ascending: true }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("projects").select("id,name,client_id"),
      supabase.from("kanban_dividers").select("*").order("position", { ascending: true }),
      supabase.from("invoices").select("task_id,status").eq("status", "payee").not("task_id", "is", null),
      supabase.from("social_tasks" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("leads" as any).select("*").neq("status", "perdu").order("created_at", { ascending: false }),
    ]);
    setTasks(t.data ?? []);
    setClients(c.data ?? []);
    setProjects(p.data ?? []);
    setDividers(d.data ?? []);
    setPaidTaskIds(new Set(((inv.data as any[]) ?? []).map((r) => r.task_id)));
    const clientMap = new Map((c.data ?? []).map((x: any) => [x.id, x]));
    const enriched = ((st.data as any[]) ?? []).map((row) => ({
      ...row,
      clients: clientMap.get(row.client_id) ?? null,
    }));
    setSocialTasks(enriched);
    setLeads((l.data as any[]) ?? []);
  };
  useEffect(() => {
    load();
    window.addEventListener("tasks:changed", load);
    return () => window.removeEventListener("tasks:changed", load);
  }, []);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const triggerBatIfNeeded = (taskId: string, newStatus: Status) => {
    if (newStatus !== "bat") return;
    const t = tasks.find((x) => x.id === taskId);
    if (t && !t.bat_id) setBatForTask(t);
  };


  const triggerPrintIfNeeded = (taskId: string, newStatus: Status) => {
    if (newStatus !== "impression") return;
    const t = tasks.find((x) => x.id === taskId);
    if (t) setPrintForTask(t);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    const activeIdStr = String(active.id);

    // === SOCIAL task being dragged ===
    if (activeIdStr.startsWith("social:")) {
      const socialId = activeIdStr.slice("social:".length);
      const st = socialTasks.find((s) => s.id === socialId);
      if (!st) return;
      const targetCol = statusFromDropTarget(overId, tasks, dividers, socialTasks, leads);
      if (!targetCol) return;
      const newStatus = targetCol;
      if (!newStatus || newStatus === st.status) return;
      const doneAt = newStatus === "archive" ? new Date().toISOString() : null;
      const prev = socialTasks;
      setSocialTasks((arr) => arr.map((s) => s.id === socialId ? { ...s, status: newStatus, done_at: doneAt } : s));
      const { error } = await supabase.from("social_tasks" as any).update({
        status: newStatus,
        done_at: doneAt,
      }).eq("id", socialId);
      if (error) { toast.error(error.message); setSocialTasks(prev); }
      return;
    }

    // === LEAD being dragged ===
    if (activeIdStr.startsWith("lead:")) {
      const leadId = activeIdStr.slice("lead:".length);
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;
      const targetCol = statusFromDropTarget(overId, tasks, dividers, socialTasks, leads);
      if (!targetCol || leadKanbanStatus(lead) === targetCol) return;
      const metadata = { ...(lead.metadata ?? {}), kanban_status: targetCol };
      const prev = leads;
      setLeads((arr) => arr.map((l) => l.id === leadId ? { ...l, metadata } : l));
      const { error } = await supabase.from("leads" as any).update({ metadata }).eq("id", leadId);
      if (error) { toast.error(error.message); setLeads(prev); }
      return;
    }

    // === DIVIDER being dragged ===
    if (activeIdStr.startsWith("divider-drag:")) {
      const dividerId = activeIdStr.slice("divider-drag:".length);
      const divider = dividers.find((d) => d.id === dividerId);
      if (!divider) return;

      let newStatus: Status = divider.status as Status;
      let newPosition: number;

      if (overId.startsWith("slot:")) {
        const [, statusStr, idxStr] = overId.split(":");
        newStatus = statusStr as Status;
        const slotIndex = Number(idxStr);
        const colTasks = tasks.filter((t) => t.status === newStatus);
        const colDividers = dividers.filter((d) => d.status === newStatus && d.id !== dividerId);
        const sorted = [
          ...colTasks.map((t) => ({ pos: t.position ?? 0 })),
          ...colDividers.map((d) => ({ pos: d.position ?? 0 })),
        ].sort((a, b) => a.pos - b.pos);
        const before = sorted[slotIndex - 1];
        const after = sorted[slotIndex];
        if (!before && !after) newPosition = 10;
        else if (!before) newPosition = (after!.pos) - 5;
        else if (!after) newPosition = before.pos + 10;
        else newPosition = (before.pos + after.pos) / 2;
      } else if (STATUSES.includes(overId as Status)) {
        newStatus = overId as Status;
        newPosition = maxPositionFor(newStatus) + 10;
      } else {
        return;
      }

      if (divider.status === newStatus && divider.position === newPosition) return;

      const prev = dividers;
      setDividers((ds) =>
        ds.map((d) => (d.id === dividerId ? { ...d, status: newStatus, position: newPosition } : d))
      );
      const { error } = await supabase
        .from("kanban_dividers")
        .update({ status: newStatus, position: newPosition })
        .eq("id", dividerId);
      if (error) {
        toast.error(error.message);
        setDividers(prev);
      }
      return;
    }

    const task = tasks.find((t) => t.id === String(active.id));
    if (!task) return;

    // Drop directly on another task card → insert before/after that card.
    if (overId.startsWith("task:")) {
      const targetTaskId = overId.slice("task:".length);
      if (targetTaskId === task.id) return;
      const targetTask = tasks.find((t) => t.id === targetTaskId);
      if (!targetTask || !isKanbanStatus(targetTask.status)) return;
      const newStatus = targetTask.status;
      const colTasks = tasks.filter((t) => t.status === newStatus && t.id !== task.id);
      const colDividers = dividers.filter((d) => d.status === newStatus);
      const sorted = [
        ...colTasks.map((t) => ({ kind: "task" as const, data: t, pos: t.position ?? 0 })),
        ...colDividers.map((d) => ({ kind: "divider" as const, data: d, pos: d.position ?? 0 })),
      ].sort((a, b) => a.pos - b.pos);
      const targetIndex = sorted.findIndex((item) => item.kind === "task" && item.data.id === targetTaskId);
      if (targetIndex < 0) return;
      const draggedRect = active.rect.current.translated;
      const insertAfter = draggedRect ? draggedRect.top + draggedRect.height / 2 > over.rect.top + over.rect.height / 2 : true;
      const newPosition = positionForInsertIndex(sorted, targetIndex + (insertAfter ? 1 : 0));

      if (task.status === newStatus && task.position === newPosition) return;
      const prev = tasks;
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: newStatus, position: newPosition } : t)));
      const { error } = await supabase.from("tasks").update({ status: newStatus, position: newPosition }).eq("id", task.id);
      if (error) {
        toast.error(error.message);
        setTasks(prev);
      } else {
        triggerBatIfNeeded(task.id, newStatus);
        triggerPrintIfNeeded(task.id, newStatus);
      }
      return;
    }

    if (overId.startsWith("social-card:") || overId.startsWith("lead-card:")) {
      const newStatus = statusFromDropTarget(overId, tasks, dividers, socialTasks, leads);
      if (!newStatus || task.status === newStatus) return;
      const newPosition = maxPositionFor(newStatus) + 10;
      const prev = tasks;
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: newStatus, position: newPosition } : t)));
      const { error } = await supabase.from("tasks").update({ status: newStatus, position: newPosition }).eq("id", task.id);
      if (error) {
        toast.error(error.message);
        setTasks(prev);
      } else {
        triggerBatIfNeeded(task.id, newStatus);
        triggerPrintIfNeeded(task.id, newStatus);
      }
      return;
    }

    // Drop on a slot between items → insert at exact position
    if (overId.startsWith("slot:")) {
      const [, statusStr, idxStr] = overId.split(":");
      const newStatus = statusStr as Status;
      const slotIndex = Number(idxStr);

      // Build sorted items in target column (excluding the dragged task)
      const colTasks = tasks.filter((t) => t.status === newStatus && t.id !== task.id);
      const colDividers = dividers.filter((d) => d.status === newStatus);
      const sorted = [
        ...colTasks.map((t) => ({ kind: "task" as const, data: t, pos: t.position ?? 0 })),
        ...colDividers.map((d) => ({ kind: "divider" as const, data: d, pos: d.position ?? 0 })),
      ].sort((a, b) => a.pos - b.pos);

      const newPosition = positionForInsertIndex(sorted, slotIndex);

      // No-op check: same status and same effective position
      if (task.status === newStatus && task.position === newPosition) return;

      const prev = tasks;
      const updated = tasks.map((t) =>
        t.id === task.id ? { ...t, status: newStatus, position: newPosition } : t
      );
      setTasks(updated);
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, position: newPosition })
        .eq("id", task.id);
      if (error) {
        toast.error(error.message);
        setTasks(prev);
      } else {
        triggerBatIfNeeded(task.id, newStatus);
        triggerPrintIfNeeded(task.id, newStatus);
      }
      return;
    }

    // Drop on a divider → place task just after that divider
    if (overId.startsWith("divider:")) {
      const dividerId = overId.slice("divider:".length);
      const divider = dividers.find((d) => d.id === dividerId);
      if (!divider) return;
      const newStatus = divider.status as Status;
      const newPosition = (divider.position ?? 0) + 1;

      // Shift everything in this column with position >= newPosition by +10
      const shiftedTasks = tasks.map((t) =>
        t.id === task.id
          ? { ...t, status: newStatus, position: newPosition }
          : t.status === newStatus && (t.position ?? 0) >= newPosition
          ? { ...t, position: (t.position ?? 0) + 10 }
          : t
      );
      const shiftedDividers = dividers.map((d) =>
        d.id !== dividerId && d.status === newStatus && (d.position ?? 0) >= newPosition
          ? { ...d, position: (d.position ?? 0) + 10 }
          : d
      );
      const prev = { tasks, dividers };
      setTasks(shiftedTasks);
      setDividers(shiftedDividers);

      // Persist: update moved task + shifted siblings
      const taskUpdates = shiftedTasks.filter((t) => {
        const old = tasks.find((o) => o.id === t.id);
        return old && (old.status !== t.status || (old.position ?? 0) !== (t.position ?? 0));
      });
      const dividerUpdates = shiftedDividers.filter((d) => {
        const old = dividers.find((o) => o.id === d.id);
        return old && (old.position ?? 0) !== (d.position ?? 0);
      });

      const errors: string[] = [];
      for (const t of taskUpdates) {
        const { error } = await supabase
          .from("tasks")
          .update({ status: t.status, position: t.position })
          .eq("id", t.id);
        if (error) errors.push(error.message);
      }
      for (const d of dividerUpdates) {
        const { error } = await supabase
          .from("kanban_dividers")
          .update({ position: d.position })
          .eq("id", d.id);
        if (error) errors.push(error.message);
      }
      if (errors.length) {
        toast.error(errors[0]);
        setTasks(prev.tasks);
        setDividers(prev.dividers);
      } else {
        triggerBatIfNeeded(task.id, newStatus);
        triggerPrintIfNeeded(task.id, newStatus);
      }
      return;
    }

    // Drop on a column background → just change status (place at end)
    if (STATUSES.includes(overId as Status)) {
      const newStatus = overId as Status;
      if (task.status === newStatus) return;
      const newPosition = maxPositionFor(newStatus) + 10;
      const prev = tasks;
      setTasks((ts) =>
        ts.map((t) => (t.id === task.id ? { ...t, status: newStatus, position: newPosition } : t))
      );
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, position: newPosition })
        .eq("id", task.id);
      if (error) {
        toast.error(error.message);
        setTasks(prev);
      } else {
        triggerBatIfNeeded(task.id, newStatus);
        triggerPrintIfNeeded(task.id, newStatus);
      }
    }
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const activeSocialTask = activeId?.startsWith("social:") ? socialTasks.find((t) => t.id === activeId.slice("social:".length)) : null;
  const activeLead = activeId?.startsWith("lead:") ? leads.find((lead) => lead.id === activeId.slice("lead:".length)) : null;

  const maxPositionFor = (status: Status) => {
    const taskMax = Math.max(0, ...tasks.filter((t) => t.status === status).map((t) => t.position ?? 0));
    const divMax = Math.max(0, ...dividers.filter((d) => d.status === status).map((d) => d.position ?? 0));
    return Math.max(taskMax, divMax);
  };

  const addDivider = async (status: Status) => {
    const position = maxPositionFor(status) + 10;
    const { data, error } = await supabase
      .from("kanban_dividers")
      .insert({ status, label: "Nouveau séparateur", position })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setDividers((ds) => [...ds, data]);
  };

  const updateDivider = async (id: string, label: string) => {
    setDividers((ds) => ds.map((d) => (d.id === id ? { ...d, label } : d)));
    const { error } = await supabase.from("kanban_dividers").update({ label }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteDivider = async (id: string) => {
    const prev = dividers;
    setDividers((ds) => ds.filter((d) => d.id !== id));
    const { error } = await supabase.from("kanban_dividers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      setDividers(prev);
    }
  };

  const updateTask = async (taskId: string, patch: any) => {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const next = { ...t, ...patch };
      if (patch.client_id !== undefined) {
        const c = clients.find((x) => x.id === patch.client_id);
        next.clients = c ? { name: c.name } : null;
      }
      return next;
    }));
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error) {
      toast.error(error.message);
      setTasks(prev);
    }
  };

  const create = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    const payload: any = {
      title: form.title.trim(),
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      prestation: form.prestation,
      prestations: form.prestation ? [form.prestation] : [],
      priority: form.priority,
      deadline: form.deadline || null,
      billing_type: form.billing_type,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      flat_amount: form.flat_amount ? Number(form.flat_amount) : null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : 0,
      estimated_print_amount: form.estimated_print_amount ? Number(form.estimated_print_amount) : null,
    };
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Tâche créée");
    setOpen(false);
    setForm({ title: "", client_id: "", project_id: "", prestation: "creation", priority: "secondaire", deadline: "", billing_type: "horaire", hourly_rate: "", flat_amount: "", estimated_minutes: "", estimated_print_amount: "" });
    load();
  };

  const quickAddTask = async (status: Status, title: string) => {
    const position = maxPositionFor(status) + 10;
    const { error } = await supabase.from("tasks").insert({
      title,
      status,
      position,
      prestation: "creation",
      prestations: ["creation"],
      priority: "secondaire",
      billing_type: "horaire",
    } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (detectMultipleDeliverables(title)) {
      toast("Plusieurs livrables détectés", {
        description: "Cette tâche ressemble à un projet. Tu veux la transformer ?",
        action: { label: "Créer projet", onClick: () => suggestConvertToProject(title) },
      });
    }
    await load();
  };

  const suggestConvertToProject = async (title: string) => {
    // Just navigate to new project page with prefilled name via query param.
    const params = new URLSearchParams({ name: title });
    window.location.href = `/projets?new=1&${params.toString()}`;
  };

  const completeTask = async (task: any, action: "bat" | "print" | "invoice" | "archive") => {
    if (action === "bat") {
      if (task.bat_id) {
        toast.info("Cette tâche a déjà un BAT lié");
        return;
      }
      setBatForTask(task);
    } else if (action === "print") {
      setPrintForTask(task);
    } else if (action === "archive") {
      const { error } = await supabase.from("tasks").update({ status: "archive" } as any).eq("id", task.id);
      if (error) return toast.error(error.message);
      toast.success("Tâche archivée");
      load();
    }
  };

  const filteredProjects = projects.filter((p) => !form.client_id || p.client_id === form.client_id);

  const q = search.trim().toLowerCase();
  const filteredTasks = q
    ? tasks.filter((t) => {
        const prestList: string[] = (t.prestations && t.prestations.length > 0)
          ? t.prestations
          : (t.prestation ? [t.prestation] : []);
        const prestLabels = prestList.map((k) => PRESTATION_LABEL[k] ?? k).join(" ");
        const haystack = [
          t.title,
          t.notes,
          t.clients?.name,
          t.projects?.name,
          prestList.join(" "),
          prestLabels,
          t.status,
          STATUS_LABEL[t.status],
          t.priority,
          PRIORITY_LABEL[t.priority],
          t.deadline,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
    : tasks;

  const filteredSocialTasks = q
    ? socialTasks.filter((t) => {
        const h = [t.title, t.description, t.clients?.name, t.status, t.priority]
          .filter(Boolean).join(" ").toLowerCase();
        return h.includes(q);
      })
    : socialTasks;

  const filteredLeads = q
    ? leads.filter((lead) => {
        const h = [lead.name, lead.company, lead.email, lead.phone, lead.source, lead.message, lead.status, LEAD_STATUS_LABEL[lead.status]]
          .filter(Boolean).join(" ").toLowerCase();
        return h.includes(q);
      })
    : leads;

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Tâches"
        description={
          q
            ? `${filteredTasks.length} / ${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`
            : `${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`
        }
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
                  <Input
                    value={form.title}
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      setShowProjectHint(detectMultipleDeliverables(e.target.value));
                    }}
                  />
                  {showProjectHint && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs">
                      <FolderPlus className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-amber-700 dark:text-amber-400 font-medium">Plusieurs livrables détectés</p>
                        <p className="text-muted-foreground mt-0.5">Cette tâche ressemble à un projet. Tu pourrais la découper en plusieurs tâches sous un même projet.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] shrink-0"
                        onClick={() => { setOpen(false); window.location.href = `/projets?new=1&name=${encodeURIComponent(form.title)}`; }}
                      >
                        Créer un projet
                      </Button>
                    </div>
                  )}
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Budget impression estimé (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={form.estimated_print_amount}
                    onChange={(e) => setForm({ ...form, estimated_print_amount: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Laisse vide s'il n'y a pas d'impression. Une tâche sans budget prestation ni impression sera signalée en rouge.
                  </p>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (client, projet, prestation, titre, statut…)"
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground"
            aria-label="Effacer la recherche"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button
          size="sm"
          variant={focusMode ? "default" : "outline"}
          onClick={() => setFocusMode((v) => !v)}
          className="gap-1.5"
        >
          <Zap className="h-3.5 w-3.5" />
          {focusMode ? "Focus du jour activé" : "Focus du jour"}
        </Button>
        {focusMode && (
          <span className="text-xs text-muted-foreground">
            Seule la colonne « Aujourd'hui » est affichée. Glisse 1 à 3 tâches dedans pour la journée.
          </span>
        )}
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {(() => {
            const withProject = filteredTasks.filter((t: any) => t.projects?.name);
            const withoutProject = filteredTasks.filter((t: any) => !t.projects?.name);
            const groups = new Map<string, any[]>();
            for (const t of withProject) {
              const k = t.projects.name as string;
              if (!groups.has(k)) groups.set(k, []);
              groups.get(k)!.push(t);
            }
            const groupKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, "fr"));
            const toggle = (k: string) => setCollapsedGroups((prev) => {
              const n = new Set(prev);
              if (n.has(k)) n.delete(k); else n.add(k);
              return n;
            });
            if (filteredTasks.length === 0) {
              return (
                <Card className="overflow-hidden">
                  <div className="p-12 text-center text-sm text-muted-foreground">Aucune tâche</div>
                </Card>
              );
            }
            const Row = (t: any) => (
              <Link key={t.id} to={`/taches/${t.id}`} className="grid grid-cols-12 gap-3 px-5 py-3 hover:bg-secondary/40 items-center text-sm">
                <div className="col-span-5 truncate font-medium">{(t as any).has_unread_client_activity && <span className="inline-block mr-1.5 h-2 w-2 rounded-full bg-destructive align-middle" />}{t.title?.trim() ? t.title : (t.projects?.name ?? "Sans titre")}</div>
                <div className="col-span-2 text-muted-foreground truncate">{t.clients?.name ?? "—"}</div>
                <div className="col-span-1 text-muted-foreground text-xs truncate">
                  {(() => {
                    const list: string[] = (t.prestations && t.prestations.length > 0)
                      ? t.prestations
                      : (t.prestation ? [t.prestation] : []);
                    return list.map((k) => PRESTATION_LABEL[k] ?? k).join(" · ") || "—";
                  })()}
                </div>
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
                <div className="col-span-1 flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[t.status]}</Badge>
                  {paidTaskIds.has(t.id) && (
                    <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 text-white">Payé</Badge>
                  )}
                </div>
              </Link>
            );
            const GroupHeader = ({ k, label, client, count }: { k: string; label: string; client?: string; count: number }) => (
              <button
                type="button"
                onClick={() => toggle(k)}
                className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-secondary/40 text-left"
              >
                {collapsedGroups.has(k) ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="text-sm font-semibold truncate">{label}</span>
                {client && <Badge variant="outline" className={`text-[10px] ${tagColor(client)} shrink-0`}>{client}</Badge>}
                <span className="text-xs text-muted-foreground ml-auto shrink-0">{count} tâche{count > 1 ? "s" : ""}</span>
              </button>
            );
            return (
              <div className="space-y-3">
                {groupKeys.map((k) => {
                  const list = groups.get(k)!;
                  const collapsed = collapsedGroups.has(k);
                  return (
                    <Card key={k} className="overflow-hidden">
                      <GroupHeader k={k} label={k} client={list[0]?.clients?.name} count={list.length} />
                      {!collapsed && <div className="divide-y border-t">{list.map((t) => Row(t))}</div>}
                    </Card>
                  );
                })}
                {withoutProject.length > 0 && (
                  <Card className="overflow-hidden">
                    <GroupHeader k="__sans_projet__" label="Sans projet" count={withoutProject.length} />
                    {collapsedGroups.has("__sans_projet__") ? null : (
                      <div className="divide-y border-t">{withoutProject.map((t) => Row(t))}</div>
                    )}
                  </Card>
                )}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <DndContext sensors={sensors} collisionDetection={kanbanCollisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
              {(focusMode ? (["aujourdhui"] as const) : STATUSES).map((s) => (
                <KanbanColumn
                  key={s}
                  status={s}
                  tasks={filteredTasks.filter((t) => t.status === s)}
                  socialTasks={filteredSocialTasks.filter((st) => SOCIAL_STATUS_TO_KANBAN[st.status] === s)}
                  leads={filteredLeads.filter((lead) => leadKanbanStatus(lead) === s)}
                  clients={clients}
                  onUpdate={updateTask}
                  dividers={dividers.filter((d) => d.status === s)}
                  onAddDivider={addDivider}
                  onUpdateDivider={updateDivider}
                  onDeleteDivider={deleteDivider}
                  paidTaskIds={paidTaskIds}
                  onQuickAdd={quickAddTask}
                  onComplete={completeTask}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask ? (
                <Card className="p-4 shadow-2xl cursor-grabbing rotate-2 border border-border">
                  <div className="text-[15px] font-semibold leading-snug mb-2">
                    {activeTask.title?.trim() ? activeTask.title : (activeTask.projects?.name ?? "Sans titre")}
                  </div>
                  {activeTask.clients?.name && (
                    <Badge variant="outline" className={`text-[11px] ${tagColor(activeTask.clients.name)}`}>
                      {activeTask.clients.name}
                    </Badge>
                  )}
                </Card>
              ) : activeSocialTask ? (
                <Card className="p-4 shadow-2xl cursor-grabbing rotate-2 border border-border">
                  <div className="text-[15px] font-semibold leading-snug mb-2">{activeSocialTask.title}</div>
                  <Badge variant="outline" className="text-[11px]">Réseaux sociaux</Badge>
                </Card>
              ) : activeLead ? (
                <Card className="p-4 shadow-2xl cursor-grabbing rotate-2 border border-border">
                  <div className="text-[15px] font-semibold leading-snug mb-2">
                    {activeLead.name || activeLead.company || activeLead.email || activeLead.phone || "Nouveau lead"}
                  </div>
                  <Badge variant="outline" className="text-[11px] border-primary/40 bg-primary/10 text-primary">Lead</Badge>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <SocialTasksAggregate />
        </TabsContent>
      </Tabs>
      <NewBatDialog
        task={batForTask}
        open={!!batForTask}
        onOpenChange={(v) => { if (!v) setBatForTask(null); }}
        onCreated={async () => {
          if (batForTask) {
            await supabase.from("tasks").update({ status: "bat" } as any).eq("id", batForTask.id);
          }
          setBatForTask(null);
          load();
        }}
      />
      <NewPrintOrderDialog
        task={printForTask}
        open={!!printForTask}
        onOpenChange={(v) => { if (!v) setPrintForTask(null); }}
        onCreated={async () => {
          if (printForTask) {
            await supabase.from("tasks").update({ status: "impression" } as any).eq("id", printForTask.id);
          }
          setPrintForTask(null);
          load();
        }}
      />
    </div>
  );
}
