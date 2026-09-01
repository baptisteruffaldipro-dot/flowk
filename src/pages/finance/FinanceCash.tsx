import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinanceVAT from "./FinanceVAT";
import FinanceTreasury from "./FinanceTreasury";

/** TVA (globale, un seul compte) + trésorerie : « combien je dois sortir et quand ». */
export default function FinanceCash() {
  const [tab, setTab] = useState("tresorerie");
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="TVA & Trésorerie" description="Ce qui rentre, ce qui sort, et ce qu'il faut provisionner." />
      <FinanceNav />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="tresorerie">Trésorerie</TabsTrigger>
          <TabsTrigger value="tva">TVA (globale)</TabsTrigger>
        </TabsList>
        <TabsContent value="tresorerie"><FinanceTreasury embedded /></TabsContent>
        <TabsContent value="tva"><FinanceVAT embedded /></TabsContent>
      </Tabs>
    </div>
  );
}
