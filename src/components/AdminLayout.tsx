import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, ShoppingCart, Settings2, ChevronDown, Search, Plus, LayoutDashboard, Users, FolderKanban, ListChecks, Printer, Receipt, LogOut, Sparkles, Inbox, FileCheck2, CalendarDays, ClipboardList, Send, Menu, Sparkle, UserPlus, Palette, Share2, TrendingUp, MailQuestion, Landmark, Wallet, Lightbulb, CalendarRange } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QuickCreateMenu } from "@/components/QuickCreateMenu";
import { cn } from "@/lib/utils";
import QuickCapture from "@/components/QuickCapture";
import GlobalTimer from "@/components/GlobalTimer";
import NotificationsBell from "@/components/NotificationsBell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NavItem = { to: string; label: string; end?: boolean; badgeKey?: "leads" | "demandes" };
type NavGroup = { label: string; icon: any; items: NavItem[] };
const groups: NavGroup[] = [
  { label: "Aujourd'hui", icon: Home, items: [
    { to: "/", label: "Accueil", end: true },
    { to: "/agenda", label: "Agenda" },
    { to: "/demandes", label: "Demandes clients", badgeKey: "demandes" },
    { to: "/leads", label: "Leads", badgeKey: "leads" },
  ]},
  { label: "Ventes", icon: ShoppingCart, items: [
    { to: "/clients", label: "Clients" },
    { to: "/taches", label: "Tâches" },
    { to: "/impressions", label: "Impressions" },
  ]},
  { label: "Création", icon: Palette, items: [
    { to: "/questionnaires", label: "Questionnaires" },
    { to: "/strategies", label: "Stratégies de marque" },
    { to: "/logos", label: "Présentations logo" },
    { to: "/notes", label: "Idées / Notes" },
  ]},
  { label: "Pilotage", icon: TrendingUp, items: [
    { to: "/finance", label: "Finance" },
    { to: "/rdv", label: "Rendez-vous" },
  ]},
  { label: "Réglages", icon: Settings2, items: [
    { to: "/parametres/paiement", label: "Paiement (RIB)" },
  ]},
];

export default function AdminLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadLeads, setUnreadLeads] = useState(0);
  const [unreadDemandes, setUnreadDemandes] = useState(0);
  const location = useLocation();
  const [newOpen, setNewOpen] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("nav-closed") || "{}"); } catch { return {}; }
  });
  const toggleGroup = (g: string) => setClosed((c) => { const n = { ...c, [g]: !c[g] }; localStorage.setItem("nav-closed", JSON.stringify(n)); return n; });

  useEffect(() => {
    const loadCount = async () => {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      setUnreadLeads(count ?? 0);
    };
    loadCount();
    const channel = supabase
      .channel("leads-sidebar")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload: any) => {
        loadCount();
        const l = payload.new;
        toast.success("Nouveau lead reçu", {
          description: l?.name || l?.email || l?.phone || "Nouveau contact",
          action: { label: "Voir", onClick: () => navigate("/leads") },
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, () => loadCount())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "leads" }, () => loadCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  useEffect(() => {
    const loadDemandes = async () => {
      const lastSeen = localStorage.getItem("demandes-last-seen") || "1970-01-01T00:00:00Z";
      const { count } = await supabase
        .from("client_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["validee", "refusee"])
        .or(`client_validated_at.gt.${lastSeen},client_refused_at.gt.${lastSeen}`);
      setUnreadDemandes(count ?? 0);
    };
    loadDemandes();
  }, []);

  useEffect(() => {
    if (location.pathname === "/demandes") {
      localStorage.setItem("demandes-last-seen", new Date().toISOString());
      setUnreadDemandes(0);
    }
  }, [location.pathname]);

  // Safety: reset body pointer-events that Radix Dialog/Sheet may leave stuck
  // after a dialog closes too quickly (known Radix issue). Without this, the
  // mobile burger button becomes unclickable.
  useEffect(() => {
    document.body.style.pointerEvents = "";
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) {
      const t = setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 300);
      return () => clearTimeout(t);
    }
  }, [mobileNavOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCaptureOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-5 pb-4 flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center text-sm font-bold">S</div>
        <div className="text-base font-semibold tracking-tight text-sidebar-accent-foreground">Studio</div>
      </div>
      <div className="px-3 space-y-2">
        <button
          onClick={() => { setCaptureOpen(true); setMobileNavOpen(false); }}
          className="w-full flex items-center gap-2 h-10 px-3 rounded-full bg-card text-muted-foreground text-sm"
        >
          <Search className="h-4 w-4" /> <span className="truncate">Rechercher ou capturer…</span>
          <span className="ml-auto text-[10px] border rounded px-1 hidden md:inline">⌘K</span>
        </button>
        <Popover open={newOpen} onOpenChange={setNewOpen}>
          <PopoverTrigger asChild>
            <button className="w-full flex items-center gap-2 h-10 px-4 rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold hover:opacity-90">
              <Plus className="h-4 w-4" /> Nouveau <ChevronDown className="h-4 w-4 ml-auto" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <QuickCreateMenu variant="list" onCreated={() => { setNewOpen(false); setMobileNavOpen(false); }} />
          </PopoverContent>
        </Popover>
        <div className="[&_button]:text-sidebar-foreground [&_button:hover]:bg-sidebar-accent"><NotificationsBell /></div>
      </div>
      <div className="h-px bg-sidebar-border my-3" />
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-4">
        {groups.map((g) => {
          const isOpen = !closed[g.label];
          return (
            <div key={g.label}>
              <button onClick={() => toggleGroup(g.label)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent">
                <g.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown className={cn("h-4 w-4 opacity-60 transition-transform", !isOpen && "-rotate-90")} />
              </button>
              {isOpen && (
                <div className="ml-4 pl-2 border-l border-sidebar-border space-y-0.5 py-1">
                  {g.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) => cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors",
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badgeKey === "leads" && unreadLeads > 0 && (
                        <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-semibold">{unreadLeads}</span>
                      )}
                      {item.badgeKey === "demandes" && unreadDemandes > 0 && (
                        <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-semibold">{unreadDemandes}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center text-xs font-bold uppercase">{user?.email?.[0] ?? "B"}</div>
        <div className="min-w-0 flex-1 text-xs truncate">{user?.email}</div>
        <button onClick={handleSignOut} aria-label="Déconnexion" className="p-1.5 rounded hover:bg-sidebar-accent"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Sidebar mobile (sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-72 flex flex-col bg-sidebar border-sidebar-border">
          {SidebarContent}
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="md:hidden sticky top-0 z-40 flex items-center gap-2 px-3 h-14 border-b border-border bg-card/95 backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="text-sm font-semibold tracking-tight">Studio</div>
          <div className="ml-auto">
            <Button onClick={() => setCaptureOpen(true)} size="sm" variant="secondary" className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Capture
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} />
      <GlobalTimer />
    </div>
  );
}
