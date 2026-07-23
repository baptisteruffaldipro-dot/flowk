import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Upload, Wallet, TrendingUp, Receipt, Percent, Sparkles, PieChart, BarChart3, SplitSquareHorizontal } from "lucide-react";

const items = [
  { to: "/finance", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/finance/import", label: "Import Tiime", icon: Upload },
  { to: "/finance/tresorerie", label: "Trésorerie", icon: Wallet },
  { to: "/finance/ca", label: "Chiffre d'affaires", icon: TrendingUp },
  { to: "/finance/split", label: "Répartition presta/achat", icon: SplitSquareHorizontal },
  { to: "/finance/depenses", label: "Dépenses", icon: Receipt },
  { to: "/finance/tva", label: "TVA", icon: Percent },
  { to: "/finance/previsions", label: "Prévisions", icon: Sparkles },
  { to: "/finance/rentabilite", label: "Rentabilité", icon: PieChart },
  { to: "/finance/rapports", label: "Rapports", icon: BarChart3 },
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