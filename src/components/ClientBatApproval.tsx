import { useState } from "react";
import { ArrowRight, CheckCircle2, FileCheck2, Pencil, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const CLIENT_BAT_CHECKS = [
  "Les textes sont justes : orthographe, dates et coordonnées",
  "Le format, le sens de lecture et les indications techniques sont bons",
  "Les couleurs, les visuels et les logos sont conformes (rendu écran indicatif)",
];

interface Props {
  busy: boolean;
  approved?: boolean;
  signedBy?: string;
  signedAt?: string;
  canValidate?: boolean;
  onApprove: (name: string) => Promise<boolean | void>;
  onCorrection: (note: string) => Promise<boolean | void>;
  onCertificate?: () => void;
  downloadUrl?: string;
}

export default function ClientBatApproval({ busy, approved, signedBy, signedAt, canValidate = true, onApprove, onCorrection, onCertificate, downloadUrl }: Props) {
  const [checks, setChecks] = useState([false, false, false]);
  const [name, setName] = useState("");
  const [correction, setCorrection] = useState(false);
  const [note, setNote] = useState("");
  const count = checks.filter(Boolean).length;

  if (approved) return (
    <div className="space-y-5 border-l-2 border-success pl-5 py-2">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-9 w-9 shrink-0 text-success" />
        <div><h2 className="text-lg font-semibold">BAT validé</h2><p className="text-sm text-muted-foreground">Merci, votre accord a bien été enregistré.</p></div>
      </div>
      {(signedBy || signedAt) && <p className="text-sm text-muted-foreground">{signedBy && <>Validé par <strong className="text-foreground">{signedBy}</strong></>}{signedAt && <> · {new Date(signedAt).toLocaleString("fr-FR")}</>}</p>}
      <p className="text-sm leading-relaxed text-muted-foreground">L’atelier vous tient informé de la suite de votre commande. Le lancement de l’impression reste soumis au règlement prévu.</p>
      {downloadUrl && <Button asChild className="w-full"><a href={downloadUrl} target="_blank" rel="noreferrer"><FileCheck2 className="mr-2 h-4 w-4" />Télécharger le BAT</a></Button>}
      {onCertificate && <Button variant="outline" className="w-full" onClick={onCertificate}><FileCheck2 className="mr-2 h-4 w-4" />Certificat de validation</Button>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Vérifiez, puis validez votre BAT</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Tout est conforme ? Signez votre accord. Sinon, demandez une correction.</p></div>
      {correction ? (
        <div className="space-y-3">
          <label htmlFor="bat-correction" className="text-sm font-medium">Votre demande de correction</label>
          <Textarea id="bat-correction" autoFocus rows={5} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
          <div className="flex gap-2"><Button disabled={busy || !note.trim()} onClick={async () => { const ok = await onCorrection(note.trim()); if (ok !== false) { setNote(""); setCorrection(false); } }}><Send className="mr-2 h-4 w-4" />Envoyer</Button><Button variant="ghost" disabled={busy} onClick={() => setCorrection(false)}><X className="mr-1 h-4 w-4" />Annuler</Button></div>
        </div>
      ) : (
        <>
          {canValidate && <>
            <div className="flex justify-between text-xs font-semibold uppercase text-muted-foreground"><span>Avant de valider</span><span aria-live="polite">{count}/3</span></div>
            <div className="space-y-2">{CLIENT_BAT_CHECKS.map((text, i) => <label key={text} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm leading-relaxed transition-colors ${checks[i] ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}><Checkbox className="mt-1 shrink-0" checked={checks[i]} onCheckedChange={v => setChecks(prev => prev.map((c, j) => j === i ? v === true : c))} /><span>{text}</span></label>)}</div>
            <div className="space-y-2"><label htmlFor="bat-signer" className="text-xs font-semibold">Votre nom, pour le certificat de validation</label><Input id="bat-signer" autoComplete="name" value={name} maxLength={100} onChange={e => setName(e.target.value)} /></div>
            <Button className="w-full justify-between" disabled={busy || count !== 3 || !name.trim()} onClick={() => onApprove(name.trim())}>Je valide le BAT<ArrowRight className="h-4 w-4" /></Button>
          </>}
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => setCorrection(true)}><Pencil className="mr-2 h-4 w-4" />Demander une correction</Button>
          <p className="text-xs leading-relaxed text-muted-foreground">La validation autorise la production ou la diffusion en l’état. Vérifiez également les mentions légales. Toute erreur non signalée avant validation reste sous votre responsabilité. Les couleurs à l’écran sont indicatives. Toute modification ultérieure peut entraîner un coût et un délai supplémentaires.</p>
        </>
      )}
    </div>
  );
}