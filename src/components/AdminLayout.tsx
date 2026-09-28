import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, FolderKanban, ListChecks, Printer, Receipt, LogOut, Sparkles, Inbox, FileCheck2, CalendarDays, ClipboardList, Send, Menu, Sparkle, UserPlus, Palette, Share2, TrendingUp, MailQuestion, Landmark, Wallet, Lightbulb, CalendarRange } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import QuickCapture from "@/components/QuickCapture";
import GlobalTimer from "@/components/GlobalTimer";
import NotificationsBell from "@/components/NotificationsBell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NavItem = { to: string; icon: any; label: string; end?: boolean; badgeKey?: "leads" | "demandes" };
const nav: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/demandes", icon: MailQuestion, label: "Demandes clients", badgeKey: "demandes" },
  { to: "/leads", icon: UserPlus, label: "Leads", badgeKey: "leads" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/taches", icon: ListChecks, label: "Tâches" },
  { to: "/agenda", icon: CalendarRange, label: "Agenda" },
  { to: "/notes", icon: Lightbulb, label: "Idées / Notes" },
  { to: "/rdv", icon: CalendarDays, label: "Rendez-vous" },
  { to: "/questionnaires", icon: ClipboardList, label: "Questionnaires" },
  { to: "/strategies", icon: Sparkle, label: "Stratégies de marque" },
  { to: "/logos", icon: Palette, label: "Présentations logo" },
  { to: "/impressions", icon: Printer, label: "Impressions" },
  { to: "/parametres/paiement", icon: Landmark, label: "Paiement (RIB)" },
];

export default function AdminLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadLeads, setUnreadLeads] = useState(0);
  const [unreadDemandes, setUnreadDemandes] = useState(0);
  const location = useLocation();

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
    <>
      <div className="px-5 py-6">
        <div className="text-base font-semibold tracking-tight">Studio</div>
        <div className="text-xs text-muted-foreground mt-0.5">Gestion projets</div>
      </div>
      <div className="px-3 mb-2">
        <Button onClick={() => { setCaptureOpen(true); setMobileNavOpen(false); }} size="sm" className="w-full justify-start gap-2">
          <Sparkles className="h-4 w-4" /> Capture rapide
          <span className="ml-auto text-[10px] opacity-70 hidden md:inline">⌘K</span>
        </Button>
      </div>
      <div className="px-3 mb-2">
        <NotificationsBell />
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.badgeKey === "leads" && unreadLeads > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-sky-500 text-white text-[10px] font-semibold">
                {unreadLeads}
              </span>
            )}
            {item.badgeKey === "demandes" && unreadDemandes > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-semibold">
                {unreadDemandes}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" /> Déconnexion
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 border-r border-border bg-card flex-col shrink-0">
        {SidebarContent}
      </aside>

      {/* Sidebar mobile (sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-64 flex flex-col bg-card">
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
