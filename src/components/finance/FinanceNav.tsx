import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Upload, Wallet, Layers, ListChecks } from "lucide-react";

const items = [
  { to: "/finance", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/finance/transactions", label: "Transactions", icon: ListChecks },
  { to: "/finance/poles", label: "Pôles", icon: Layers },
  { to: "/finance/tresorerie", label: "TVA & Trésorerie", icon: Wallet },
  { to: "/finance/import", label: "Import Tiime", icon: Upload },
];

export default function FinanceNav() {
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border pb-2 overflow-x-auto">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors",
              isActive
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )
          }
        >
          <it.icon className="h-3.5 w-3.5" />
          {it.label}
        </NavLink>
      ))}
    </div>
  );
}
