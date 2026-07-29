INSERT INTO finance_transactions (source,kind,category,category_source,doc_number,date,paid_date,label,counterparty,counterparty_normalized,amount_ht,vat_amount,amount_ttc,dedupe_key)
SELECT 'tiime_import',v.kind::finance_kind,v.category::finance_category,'default',v.doc_number,v.date::date,v.paid_date::date,v.label,v.counterparty,v.counterparty_normalized,v.amount_ht::numeric,v.vat_amount::numeric,v.amount_ttc::numeric,v.dedupe_key FROM (VALUES
('sale','prestation','1006','2026-07-27','2026-07-27','Carte de visite - Panneaux  Facture issue du devis n°317','GC IMMOBILIER','gc immobilier',73.0,14.6,87.6,'sale|1006|2026-07-27|87.60|gc immobilier'),
('sale','prestation','1005','2026-07-25',NULL,'Création & impression carte de visite','AMR ELEC','amr elec',65.0,13.0,78.0,'sale|1005|2026-07-25|78.00|amr elec'),
('sale','prestation','1004','2026-07-24',NULL,'Ajustements menu','LOU','lou',150.0,30.0,180.0,'sale|1004|2026-07-24|180.00|lou'),
('sale','prestation','1003','2026-07-24','2026-07-24','Affiches bal des commerçants','MEDUSOR','medusor',260.0,52.0,312.0,'sale|1003|2026-07-24|312.00|medusor'),
('sale','prestation','1002','2026-07-24',NULL,'Affiches décoratives','FACE A NEW YORK','face a new york',150.0,30.0,180.0,'sale|1002|2026-07-24|180.00|face a new york'),
('sale','prestation','1001','2026-07-24',NULL,'Accompagnement en communication digitale - Mois N°2','LE SAINT MORITZ','le saint moritz',550.0,110.0,660.0,'sale|1001|2026-07-24|660.00|le saint moritz'),
('sale','prestation','1000','2026-07-23',NULL,'Impression / Création','Le ribérou','le ribérou',200.0,40.0,240.0,'sale|1000|2026-07-23|240.00|le ribérou'),
('sale','prestation','999','2026-07-18',NULL,'Impression cartes','NAUZAN BEACH','nauzan beach',780.0,156.0,936.0,'sale|999|2026-07-18|936.00|nauzan beach'),
('sale','prestation','998','2026-07-16',NULL,'Shooting / Logo / Cartes - Facture mensuelle','NAUZAN BEACH','nauzan beach',230.0,46.0,276.0,'sale|998|2026-07-16|276.00|nauzan beach'),
('sale','prestation','997','2026-07-16',NULL,'Impression cartes','Circus Restaurant','circus restaurant',641.5,128.3,769.8,'sale|997|2026-07-16|769.80|circus restaurant'),
('sale','prestation','996','2026-07-09','2026-07-09','Rétrocession - Achats','LE SAINT MORITZ','le saint moritz',83.0,16.6,99.6,'sale|996|2026-07-09|99.60|le saint moritz'),
('sale','prestation','995','2026-07-02',NULL,'Impression / Conception carte Facture issue du devis n°318','Le 13','le 13',1000.0,200.0,1200.0,'sale|995|2026-07-02|1200.00|le 13'),
('sale','prestation','994','2026-07-02','2026-07-02','Accompagnement en communication digitale','LE SAINT MORITZ','le saint moritz',500.0,100.0,600.0,'sale|994|2026-07-02|600.00|le saint moritz')
) AS v(kind,category,doc_number,date,paid_date,label,counterparty,counterparty_normalized,amount_ht,vat_amount,amount_ttc,dedupe_key)
WHERE NOT EXISTS (SELECT 1 FROM finance_transactions t WHERE t.dedupe_key=v.dedupe_key);

INSERT INTO finance_transactions (source,kind,category,category_source,doc_number,date,paid_date,label,counterparty,counterparty_normalized,amount_ht,vat_amount,amount_ttc,dedupe_key)
SELECT 'tiime_import',v.kind::finance_kind,v.category::finance_category,'default',v.doc_number,v.date::date,v.paid_date::date,v.label,v.counterparty,v.counterparty_normalized,v.amount_ht::numeric,v.vat_amount::numeric,v.amount_ttc::numeric,v.dedupe_key FROM (VALUES
('expense','expense',NULL,'2026-07-16',NULL,'REALISAPRINT.COM','REALISAPRINT','realisaprint',61.0,12.2,73.2,'expense||2026-07-16|73.20|realisaprint'),
('expense','expense',NULL,'2026-07-16',NULL,'REALISAPRINT.COM','REALISAPRINT','realisaprint',16.0,3.2,19.2,'expense||2026-07-16|19.20|realisaprint'),
('expense','expense',NULL,'2026-07-06',NULL,'REALISAPRINT.COM','REALISAPRINT','realisaprint',43.0,8.6,51.6,'expense||2026-07-06|51.60|realisaprint'),
('expense','expense',NULL,'2026-07-16',NULL,'REALISAPRINT.COM','REALISAPRINT','realisaprint',1216.13,243.23,1459.36,'expense||2026-07-16|1459.36|realisaprint'),
('expense','expense',NULL,'2026-07-15',NULL,'Apple','APPLE','apple',2.49,0.5,2.99,'expense||2026-07-15|2.99|apple'),
('expense','expense',NULL,'2026-07-01',NULL,'Apple','APPLE','apple',2.49,0.5,2.99,'expense||2026-07-01|2.99|apple'),
('expense','expense',NULL,'2026-07-03',NULL,'BUREAU VALLEE','BUREAU VALLEE','bureau vallee',30.74,6.15,36.89,'expense||2026-07-03|36.89|bureau vallee'),
('expense','expense',NULL,'2026-07-11',NULL,'Lovable Labs Incorporated','LOVABLE','lovable',25.0,0.0,25.0,'expense||2026-07-11|25.00|lovable'),
('expense','expense',NULL,'2026-07-05',NULL,'ADOBE','ADOBE','adobe',65.54,13.11,78.65,'expense||2026-07-05|78.65|adobe'),
('expense','expense',NULL,'2026-07-06',NULL,'OVH','OVH','ovh',7.79,1.56,9.35,'expense||2026-07-06|9.35|ovh'),
('expense','expense',NULL,'2026-07-07',NULL,'Apple','APPLE','apple',8.33,1.66,9.99,'expense||2026-07-07|9.99|apple'),
('expense','expense',NULL,'2026-07-01',NULL,'OpenAI OpCo, LLC','CHAT GPT','chat gpt',17.57,0.0,17.57,'expense||2026-07-01|17.57|chat gpt'),
('expense','expense',NULL,'2026-07-10',NULL,'Rôti Rôti','RESTAURANT','restaurant',42.27,4.23,46.5,'expense||2026-07-10|46.50|restaurant'),
('expense','expense',NULL,'2026-07-01',NULL,'BKPN 25790 - ADG 847 SAS','RESTAURANT','restaurant',18.32,1.83,20.15,'expense||2026-07-01|20.15|restaurant'),
('expense','expense',NULL,'2026-07-02',NULL,'PIXARTPRINTING SPA','PIXART','pixart',454.23,0.0,454.23,'expense||2026-07-02|454.23|pixart')
) AS v(kind,category,doc_number,date,paid_date,label,counterparty,counterparty_normalized,amount_ht,vat_amount,amount_ttc,dedupe_key)
WHERE NOT EXISTS (SELECT 1 FROM finance_transactions t WHERE t.dedupe_key=v.dedupe_key);

INSERT INTO finance_transactions (source,kind,category,category_source,doc_number,date,paid_date,label,counterparty,counterparty_normalized,amount_ht,vat_amount,amount_ttc,dedupe_key)
SELECT 'tiime_import',v.kind::finance_kind,v.category::finance_category,'default',v.doc_number,v.date::date,v.paid_date::date,v.label,v.counterparty,v.counterparty_normalized,v.amount_ht::numeric,v.vat_amount::numeric,v.amount_ttc::numeric,v.dedupe_key FROM (VALUES
('bank','bank',NULL,'2026-07-02',NULL,'PAIEMENT CB  0107 OPENAI *CHATGPT  CARTE 9445','CHAT GPT','chat gpt',0,0,-17.57,'bank||2026-07-02|-17.57|chat gpt'),
('bank','bank',NULL,'2026-07-02',NULL,'FRAIS PAIE CB OP 20 00     USD','FRAIS BANCAIRES','frais bancaires',0,0,-2.1,'bank||2026-07-02|-2.10|frais bancaires'),
('bank','bank',NULL,'2026-07-02',NULL,'VIR INST SARL LE SAINT MORITZ 994','LE SAINT MORITZ','le saint moritz',0,0,600.0,'bank||2026-07-02|600.00|le saint moritz'),
('bank','bank',NULL,'2026-07-01',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26182M000454','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-50.0,'bank||2026-07-01|-50.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-01',NULL,'PRLV SEPA CABINET JULIEN SICRE','CABINET JULIEN SICRE','cabinet julien sicre',0,0,-124.8,'bank||2026-07-01|-124.80|cabinet julien sicre'),
('bank','bank',NULL,'2026-07-02',NULL,'FACT SGT26390870009018','FRAIS BANCAIRES','frais bancaires',0,0,-9.0,'bank||2026-07-02|-9.00|frais bancaires'),
('bank','bank',NULL,'2026-07-03',NULL,'PAIEMENT CB  0107 ROYAN BURGER KING','RESTAURANT','restaurant',0,0,-20.15,'bank||2026-07-03|-20.15|restaurant'),
('bank','bank',NULL,'2026-07-03',NULL,'PAIEMENT CB  0207 CORK APPLE.COM/BILL','APPLE','apple',0,0,-2.99,'bank||2026-07-03|-2.99|apple'),
('bank','bank',NULL,'2026-07-03',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26184M024658','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-22.72,'bank||2026-07-03|-22.72|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-06',NULL,'PRLV SEPA ORANGE SA ABONNEMENT FIBRE','ORANGE','orange',0,0,-24.99,'bank||2026-07-06|-24.99|orange'),
('bank','bank',NULL,'2026-07-04',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26185M040939','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-90.0,'bank||2026-07-04|-90.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-05',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26186M023724','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-50.0,'bank||2026-07-05|-50.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-07',NULL,'PAIEMENT CB  0407 CORK APPLE.COM/BILL','APPLE','apple',0,0,-10.99,'bank||2026-07-07|-10.99|apple'),
('bank','bank',NULL,'2026-07-07',NULL,'PAIEMENT CB  0507 DUBLIN ADOBE','ADOBE','adobe',0,0,-78.65,'bank||2026-07-07|-78.65|adobe'),
('bank','bank',NULL,'2026-07-07',NULL,'PAIEMENT CB  0607 ROUBAIX OVHCLOUD','OVH','ovh',0,0,-9.35,'bank||2026-07-07|-9.35|ovh'),
('bank','bank',NULL,'2026-07-07',NULL,'PRLV SEPA BNP PARIBAS PERSONAL FINANCE','APPLE IPHONE','apple iphone',0,0,-55.37,'bank||2026-07-07|-55.37|apple iphone'),
('bank','bank',NULL,'2026-07-07',NULL,'PAIEMENT CB  0207 PIXARTPRINTING','PIXART','pixart',0,0,-454.23,'bank||2026-07-07|-454.23|pixart'),
('bank','bank',NULL,'2026-07-07',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26188M049617','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-200.0,'bank||2026-07-07|-200.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-07',NULL,'PAIEMENT PSC 0307 ROYAN SOC CHARENT FOUR','BUREAU VALLEE','bureau vallee',0,0,-36.89,'bank||2026-07-07|-36.89|bureau vallee'),
('bank','bank',NULL,'2026-07-08',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26189M033280','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-20.0,'bank||2026-07-08|-20.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-09',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26190M035333','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-60.0,'bank||2026-07-09|-60.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-09',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26190M049448','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-60.0,'bank||2026-07-09|-60.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-10',NULL,'PAIEMENT CB  0907 CORK APPLE.COM/BILL','APPLE','apple',0,0,-2.99,'bank||2026-07-10|-2.99|apple'),
('bank','bank',NULL,'2026-07-10',NULL,'PRLV SEPA ORANGE SA ABONNEMENT MOBILE','ORANGE','orange',0,0,-20.99,'bank||2026-07-10|-20.99|orange'),
('bank','bank',NULL,'2026-07-10',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26191M000867','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-50.0,'bank||2026-07-10|-50.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-10',NULL,'PAIEMENT CB  0907 VAUX SUR MER INTERMARCHE','CARBURANT','carburant',0,0,-50.04,'bank||2026-07-10|-50.04|carburant'),
('bank','bank',NULL,'2026-07-12',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26193M026484','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-100.0,'bank||2026-07-12|-100.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-13',NULL,'PAIEMENT PSC 1007 ROYAN ROTI','RESTAURANT','restaurant',0,0,-46.5,'bank||2026-07-13|-46.50|restaurant'),
('bank','bank',NULL,'2026-07-14',NULL,'PAIEMENT CB  1107 DOVER LOVABLE','LOVABLE','lovable',0,0,-25.0,'bank||2026-07-14|-25.00|lovable'),
('bank','bank',NULL,'2026-07-14',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26195M030474','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-100.0,'bank||2026-07-14|-100.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-11',NULL,'VIR INST SARL LE SAINT MORITZ FACTURE 996','LE SAINT MORITZ','le saint moritz',0,0,99.6,'bank||2026-07-11|99.60|le saint moritz'),
('bank','bank',NULL,'2026-07-10',NULL,'PAIEMENT CB  0907 LUXEMBOURG REALISAPRIN','REALISAPRINT','realisaprint',0,0,-19.2,'bank||2026-07-10|-19.20|realisaprint'),
('bank','bank',NULL,'2026-07-07',NULL,'PAIEMENT CB  0607 LUXEMBOURG REALISAPRIN','REALISAPRINT','realisaprint',0,0,-51.6,'bank||2026-07-07|-51.60|realisaprint'),
('bank','bank',NULL,'2026-07-03',NULL,'PAIEMENT CB  0207 LUXEMBOURG REALISAPRIN','REALISAPRINT','realisaprint',0,0,-1459.36,'bank||2026-07-03|-1459.36|realisaprint'),
('bank','bank',NULL,'2026-07-09',NULL,'REM CHQ N9132224  REF1551939087','Babajy','babajy',0,0,792.0,'bank||2026-07-09|792.00|babajy'),
('bank','bank',NULL,'2026-07-15',NULL,'PAIEMENT CB  1407 MAUGUIO EXAPRINT SAS','EXAPRINT','exaprint',0,0,-85.68,'bank||2026-07-15|-85.68|exaprint'),
('bank','bank',NULL,'2026-07-15',NULL,'PRLV SEPA DGFIP IMPOT CFE','CFE / CVAE','cfe / cvae',0,0,-30.0,'bank||2026-07-15|-30.00|cfe / cvae'),
('bank','bank',NULL,'2026-07-16',NULL,'PAIEMENT CB  1407 TOULOUSE PRINTOCLOCK','PRINTOCLOCK','printoclock',0,0,-161.18,'bank||2026-07-16|-161.18|printoclock'),
('bank','bank',NULL,'2026-07-16',NULL,'PAIEMENT CB  1507 FACEBK ADS','PUBLICITE','publicite',0,0,-50.0,'bank||2026-07-16|-50.00|publicite'),
('bank','bank',NULL,'2026-07-17',NULL,'PAIEMENT CB  1607 CORK APPLE.COM/BILL','APPLE','apple',0,0,-2.99,'bank||2026-07-17|-2.99|apple'),
('bank','bank',NULL,'2026-07-17',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26198M019417','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-450.0,'bank||2026-07-17|-450.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-17',NULL,'PAIEMENT CB  1507 TOULOUSE PRINTOCLOCK','PRINTOCLOCK','printoclock',0,0,-285.52,'bank||2026-07-17|-285.52|printoclock'),
('bank','bank',NULL,'2026-07-20',NULL,'PRLV SEPA URSSAF JUIL26','URSSAF','urssaf',0,0,-313.0,'bank||2026-07-20|-313.00|urssaf'),
('bank','bank',NULL,'2026-07-19',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26200M025027','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-60.0,'bank||2026-07-19|-60.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-20',NULL,'VIR DE M BAPTISTE RUFFALDI C12W26201M019591','Baptiste RUFFALDI','baptiste ruffaldi',0,0,1000.0,'bank||2026-07-20|1000.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-20',NULL,'PAIEMENT PSC 1807 ROYAN BURGER KING','RESTAURANT','restaurant',0,0,-20.3,'bank||2026-07-20|-20.30|restaurant'),
('bank','bank',NULL,'2026-07-21',NULL,'ECH PRET CAP IN 39087 227240 02','EMPRUNT','emprunt',0,0,-91.81,'bank||2026-07-21|-91.81|emprunt'),
('bank','bank',NULL,'2026-07-21',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26202M028643','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-60.0,'bank||2026-07-21|-60.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-21',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26202M043381','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-10.0,'bank||2026-07-21|-10.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-22',NULL,'PRLV SEPA SIE SAINTES TVA1-072026-3310CA3','TVA A PAYER','tva a payer',0,0,-863.0,'bank||2026-07-22|-863.00|tva a payer'),
('bank','bank',NULL,'2026-07-24',NULL,'PAIEMENT CB  2307 CORK APPLE.COM/BILL','APPLE','apple',0,0,-2.99,'bank||2026-07-24|-2.99|apple'),
('bank','bank',NULL,'2026-07-24',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26205M023820','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-40.0,'bank||2026-07-24|-40.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-24',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26205M047921','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-20.0,'bank||2026-07-24|-20.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-27',NULL,'VIR DE M BAPTISTE RUFFALDI C12W26208M023490','VENTES','ventes',0,0,150.0,'bank||2026-07-27|150.00|ventes'),
('bank','bank',NULL,'2026-07-27',NULL,'VIR COMPTE CHEQUE EUROCOMPTE C12W26208M035601','Baptiste RUFFALDI','baptiste ruffaldi',0,0,-20.0,'bank||2026-07-27|-20.00|baptiste ruffaldi'),
('bank','bank',NULL,'2026-07-27',NULL,'VIR INST MEDUSOR 1003 ATELIER RUFO','MEDUSOR','medusor',0,0,312.0,'bank||2026-07-27|312.00|medusor'),
('bank','bank',NULL,'2026-07-27',NULL,'VIR INST S.A.R.L. GC IMMOBILIER FACTURE 1006','GC IMMOBILIER','gc immobilier',0,0,87.6,'bank||2026-07-27|87.60|gc immobilier')
) AS v(kind,category,doc_number,date,paid_date,label,counterparty,counterparty_normalized,amount_ht,vat_amount,amount_ttc,dedupe_key)
WHERE NOT EXISTS (SELECT 1 FROM finance_transactions t WHERE t.dedupe_key=v.dedupe_key);

INSERT INTO clients (name) SELECT 'AMR ELEC' WHERE NOT EXISTS (SELECT 1 FROM clients WHERE lower(name)='amr elec');

DELETE FROM client_receivables WHERE notes='import_tiime';

INSERT INTO client_receivables (client_id, snapshot_date, invoiced_ttc, paid_ttc, outstanding_ttc, expected_payment_date, status, notes)
SELECT c.id, CURRENT_DATE, v.amt::numeric, 0, v.amt::numeric, NULL, 'a_venir', 'import_tiime'
FROM (VALUES ('AMR ELEC',78),('LOU',180),('FACE A NEW YORK',180),('LE SAINT MORITZ',660),('Le ribérou',240),('NAUZAN BEACH',1212),('Circus',769.8),('Le 13',1200)) AS v(cname, amt)
JOIN LATERAL (SELECT id FROM clients WHERE lower(name)=lower(v.cname) ORDER BY created_at LIMIT 1) c ON true;