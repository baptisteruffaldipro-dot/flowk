import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Play, Square, Timer as TimerIcon, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtMinutes } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { QuickCreateMenu } from "@/components/QuickCreateMenu";

type RunningTask = {
  id: string;
  title: string;
  timer_started_at: string;
  total_minutes: number;
  estimated_minutes: number | null;
  clients?: { name: string } | null;
};

function fmtHMS(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function GlobalTimer() {
  const { user } = useAuth();
  const [running, setRunning] = useState<RunningTask | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);

  const loadRunning = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id,title,timer_started_at,total_minutes,estimated_minutes,clients(name)")
      .not("timer_started_at", "is", null)
      .order("timer_started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRunning((data as any) ?? null);
  };

  useEffect(() => {
    if (!user) return;
    loadRunning();
    // realtime: any change on tasks.timer_started_at
    const ch = supabase
      .channel("global-timer-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadRunning())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // tick every second when running
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [running?.id]);

  const liveSeconds = useMemo(() => {
    if (!running) return 0;
    return Math.floor((Date.now() - new Date(running.timer_started_at).getTime()) / 1000);
  }, [running?.timer_started_at, tick]);

  const overEstimate = useMemo(() => {
    if (!running?.estimated_minutes) return false;
    const totalMin = (running.total_minutes ?? 0) + Math.floor(liveSeconds / 60);
    return totalMin > running.estimated_minutes;
  }, [running, liveSeconds]);

  const stop = async () => {
    if (!running) return;
    const startedAt = running.timer_started_at;
    const endedAt = new Date().toISOString();
    const dur = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
    const newTotal = (running.total_minutes ?? 0) + dur;
    const { error } = await supabase.from("tasks").update({ timer_started_at: null, total_minutes: newTotal }).eq("id", running.id);
    if (error) return toast.error(error.message);
    await supabase.from("time_entries").update({ ended_at: endedAt, duration_minutes: dur }).eq("task_id", running.id).is("ended_at", null);
    toast.success(`Timer arrêté — ${fmtMinutes(dur)} ajouté`);
    loadRunning();
  };

  const openPicker = async () => {
    setPickerOpen(true);
    const { data } = await supabase
      .from("tasks")
      .select("id,title,clients(name),projects(name)")
      .not("status", "in", "(envoye,archive)")
      .order("updated_at", { ascending: false })
      .limit(50);
    setTasks(data ?? []);
  };

  const startOn = async (taskId: string) => {
    // Stop any other running task first (defensive)
    const startedAt = new Date().toISOString();
    const { error } = await supabase.from("tasks").update({ timer_started_at: startedAt }).eq("id", taskId);
    if (error) return toast.error(error.message);
    await supabase.from("time_entries").insert({ task_id: taskId, started_at: startedAt });
    setPickerOpen(false);
    toast.success("Timer démarré");
    loadRunning();
  };

  if (!user) return null;

  return (
    <>
      <div className="fixed bottom-20 right-4 z-50 sm:bottom-4">
        {running ? (
          <Card className={`p-2 pr-2.5 sm:p-2.5 sm:pr-3 shadow-lg border-2 ${overEstimate ? "border-destructive" : "border-primary"} bg-card flex items-center gap-2 sm:gap-3 max-w-[calc(100vw-2rem)] sm:min-w-[260px]`}>
            <div className={`h-2 w-2 rounded-full animate-pulse ${overEstimate ? "bg-destructive" : "bg-primary"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums">{fmtHMS(liveSeconds)}</span>
                <Link to={`/taches/${running.id}`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="text-xs text-muted-foreground truncate leading-tight">
                {running.title}
                {running.clients?.name ? ` • ${running.clients.name}` : ""}
              </div>
            </div>
            <Button onClick={stop} size="sm" variant="destructive" className="h-8 px-2.5 gap-1 shrink-0" aria-label="Arrêter le timer">
              <Square className="h-3.5 w-3.5 fill-current" /> <span className="hidden sm:inline">Stop</span>
            </Button>
          </Card>
        ) : (
          <div className="flex items-center gap-2">
            {/* Mobile: bouton icône timer */}
            <Button onClick={openPicker} size="icon" variant="default" className="sm:hidden shadow-lg h-11 w-11 rounded-full" aria-label="Démarrer un timer">
              <TimerIcon className="h-5 w-5" />
            </Button>
            {/* Desktop: bouton timer */}
            <Button onClick={openPicker} size="sm" variant="default" className="hidden sm:inline-flex shadow-lg gap-2 h-10">
              <TimerIcon className="h-4 w-4" /> Démarrer un timer
            </Button>

            <Popover open={quickOpen} onOpenChange={setQuickOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="shadow-lg bg-card h-11 w-11 sm:h-10 sm:w-auto sm:px-3 rounded-full sm:rounded-md p-0 flex items-center justify-center"
                  aria-label="Créer rapidement"
                >
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline ml-1.5 text-sm font-medium">Créer</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-xl p-4" align="end">
                <div className="text-sm font-semibold mb-3">Créer rapidement</div>
                <QuickCreateMenu onCreated={() => setQuickOpen(false)} />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="p-0 max-w-xl gap-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm">Sur quelle tâche démarrer ?</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Rechercher une tâche…" autoFocus />
            <CommandList className="max-h-80">
              <CommandEmpty>Aucune tâche</CommandEmpty>
              <CommandGroup>
                {tasks.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`${t.title} ${t.clients?.name ?? ""} ${t.projects?.name ?? ""}`}
                    onSelect={() => startOn(t.id)}
                    className="cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 mr-2 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.clients?.name ?? "—"}{t.projects?.name ? ` • ${t.projects.name}` : ""}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}