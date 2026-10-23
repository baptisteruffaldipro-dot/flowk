import { Mail } from "lucide-react";
import { EMAIL_KIND_LABEL, summarizeHistory } from "@/lib/emailHistory";
import { fmtDateTime } from "@/lib/format";

export function EmailHistoryList({ history, title = "Envois & relances" }: { history: unknown; title?: string }) {
  const { list, reminders, sends } = summarizeHistory(history);
  if (list.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        <span>{title}</span>
        <span>· {sends} envoi{sends > 1 ? "s" : ""} · {reminders} relance{reminders > 1 ? "s" : ""}</span>
      </div>
      <ul className="space-y-1 text-xs">
        {list.map((e, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>{EMAIL_KIND_LABEL[e.kind]}</span>
            <span className="text-muted-foreground tabular-nums">{fmtDateTime(e.sent_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
