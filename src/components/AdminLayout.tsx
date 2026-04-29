import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FolderKanban, ListChecks, Printer, Receipt, LogOut, Sparkles, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import QuickCapture from "@/components/QuickCapture";
import GlobalTimer from "@/components/GlobalTimer";

const nav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/inbox", icon: Inbox, label: "Inbox" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/projets", icon: FolderKanban, label: "Projets" },
  { to: "/taches", icon: ListChecks, label: "Tâches" },
  { to: "/impressions", icon: Printer, label: "Impressions" },
  { to: "/facturation", icon: Receipt, label: "Facturation" },
];

export default function AdminLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [captureOpen, setCaptureOpen] = useState(false);

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

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-60 border-r border-border bg-card flex flex-col">
        <div className="px-5 py-6">
          <div className="text-base font-semibold tracking-tight">Studio</div>
          <div className="text-xs text-muted-foreground mt-0.5">Gestion projets</div>
        </div>
        <div className="px-3 mb-2">
          <Button onClick={() => setCaptureOpen(true)} size="sm" className="w-full justify-start gap-2">
            <Sparkles className="h-4 w-4" /> Capture rapide
            <span className="ml-auto text-[10px] opacity-70">⌘K</span>
          </Button>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} />
      <GlobalTimer />
    </div>
  );
}