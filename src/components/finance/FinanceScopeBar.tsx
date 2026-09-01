import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { periodRange, setFinanceScope, shiftPeriod, useFinanceScope, type PeriodType } from "@/lib/finance/scope";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PERIODS: { value: PeriodType; label: string }[] = [
  { value: "month", label: "Mois" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Année" },
  { value: "custom", label: "Perso" },
];

/** Barre de filtres partagée : pôle d'activité + période. */
export default function FinanceScopeBar({ showUnits = true }: { showUnits?: boolean }) {
  const scope = useFinanceScope();
  const { activeUnits } = useBusinessUnits();
  const range = periodRange(scope);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {showUnits && (
        <div className="flex flex-wrap gap-1">
          <Chip active={scope.buId === null} onClick={() => setFinanceScope({ buId: null })}>
            Tous les pôles
          </Chip>
          {activeUnits.map((u) => (
            <Chip key={u.id} active={scope.buId === u.id} color={u.color} onClick={() => setFinanceScope({ buId: u.id })}>
              {u.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Chip key={p.value} active={scope.periodType === p.value} onClick={() => setFinanceScope({ periodType: p.value })}>
              {p.label}
            </Chip>
          ))}
        </div>

        {scope.periodType === "custom" ? (
          <div className="flex items-center gap-1">
            <Input type="date" className="h-8 w-[140px]" value={scope.anchor} onChange={(e) => setFinanceScope({ anchor: e.target.value })} />
            <span className="text-xs text-muted-foreground">→</span>
            <Input type="date" className="h-8 w-[140px]" value={scope.customEnd} onChange={(e) => setFinanceScope({ customEnd: e.target.value })} />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setFinanceScope({ anchor: shiftPeriod(scope, -1) })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[130px] text-center text-sm font-medium capitalize">{range.label}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setFinanceScope({ anchor: shiftPeriod(scope, 1) })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-transparent bg-secondary font-medium text-foreground" : "border-border text-muted-foreground hover:bg-secondary/60",
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}
