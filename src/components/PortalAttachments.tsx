import { useRef, useState } from "react";
import { Loader2, Paperclip, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  MAX_ATTACHMENTS,
  formatFileSize,
  getPortalFileUrl,
  uploadPortalFile,
  type PortalAttachment,
} from "@/lib/portalUploads";

/** Bouton « Joindre des fichiers » + liste des fichiers prêts à partir. */
export function AttachmentPicker({
  token,
  value,
  onChange,
  disabled,
  onUploadingChange,
}: {
  token: string;
  value: PortalAttachment[];
  onChange: (next: PortalAttachment[]) => void;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_ATTACHMENTS - value.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast.error(`${MAX_ATTACHMENTS} fichiers maximum par envoi`);
    setUploading((n) => n + list.length);
    onUploadingChange?.(true);
    let next = [...value];
    for (const file of list) {
      try {
        const att = await uploadPortalFile(token, file);
        next = [...next, att];
        onChange(next);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onUploadingChange?.(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a) => (
            <li key={a.path} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="shrink-0 text-muted-foreground">{formatFileSize(a.size)}</span>
              <button
                type="button"
                aria-label={`Retirer ${a.name}`}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => onChange(value.filter((x) => x.path !== a.path))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        disabled={disabled || uploading > 0 || value.length >= MAX_ATTACHMENTS}
        onClick={() => inputRef.current?.click()}
      >
        {uploading > 0 ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-1.5 h-3.5 w-3.5" />}
        {uploading > 0 ? "Envoi du fichier…" : "Joindre des fichiers"}
      </Button>
    </div>
  );
}

/** Liste cliquable des fichiers joints à un message. */
export function AttachmentList({ attachments, token }: { attachments?: PortalAttachment[] | null; token?: string }) {
  const [opening, setOpening] = useState<string | null>(null);
  if (!attachments || attachments.length === 0) return null;
  const open = async (a: PortalAttachment) => {
    setOpening(a.path);
    const win = window.open("", "_blank");
    const url = await getPortalFileUrl(a.path, token);
    setOpening(null);
    if (!url) {
      win?.close();
      return void toast.error("Fichier indisponible");
    }
    if (win) win.location.href = url;
    else window.location.href = url;
  };
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map((a) => (
        <button
          key={a.path}
          type="button"
          onClick={() => open(a)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-secondary"
        >
          {opening === a.path ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3 shrink-0" />}
          <span className="truncate">{a.name}</span>
          {a.size > 0 && <span className="shrink-0 text-muted-foreground">{formatFileSize(a.size)}</span>}
        </button>
      ))}
    </div>
  );
}
