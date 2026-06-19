import { Card } from "@/components/ui/card";
import { QuickCreateMenu } from "./QuickCreateMenu";

export default function QuickCreate({ onCreated }: { onCreated?: () => void }) {
  return (
    <Card className="p-5">
      <div className="mb-5">
        <div className="text-sm font-semibold tracking-tight">Créer rapidement</div>
        <div className="text-xs text-muted-foreground mt-0.5">Une tâche, un projet, une commande, une demande client ou un questionnaire</div>
      </div>
      <QuickCreateMenu onCreated={onCreated} />
    </Card>
  );
}
