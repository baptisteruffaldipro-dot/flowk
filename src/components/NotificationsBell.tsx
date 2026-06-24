import { useEffect, useId, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  return `il y a ${Math.floor(d / 86400)} j`;
}

export default function NotificationsBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const instanceId = useId();

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id,kind,title,body,link,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Notif[]) ?? []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`notifications-bell-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: any) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 30));
          if (n.kind === "client_request_refused") {
            toast.error(n.title, {
              description: n.body ?? undefined,
              action: n.link ? { label: "Voir", onClick: () => navigate(n.link!) } : undefined,
            });
          } else {
            toast.success(n.title, {
              description: n.body ?? undefined,
              action: n.link ? { label: "Voir", onClick: () => navigate(n.link!) } : undefined,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    load();
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    load();
  };

  const onClick = async (n: Notif) => {
    if (!n.read_at) await markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative w-full justify-start gap-2">
          <Bell className="h-4 w-4" />
          <span>Notifications</span>
          {unread > 0 && (
            <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-medium">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="h-3.5 w-3.5 mr-1" /> Tout marquer lu
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune notification</div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "group flex items-start gap-2 px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/60 cursor-pointer",
                  !n.read_at && "bg-secondary/30"
                )}
                onClick={() => onClick(n)}
              >
                {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-sky-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</div>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(n.id);
                  }}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}