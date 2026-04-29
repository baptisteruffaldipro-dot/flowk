
-- 1. Wipe tasks et dividers
DELETE FROM time_entries;
DELETE FROM subtasks;
DELETE FROM tasks;
DELETE FROM kanban_dividers;

-- 2. Créer les clients manquants
INSERT INTO clients (name) VALUES
  ('Le groupe immobilier'),
  ('Allez'),
  ('Vanille seul'),
  ('Sophie Cobo'),
  ('La petite cour'),
  ('Goora'),
  ('D''RENO'),
  ('Studio Réamur'),
  ('SPC'),
  ('Ville de Théza'),
  ('La piraterie'),
  ('Céleste'),
  ('Maison Revidat'),
  ('Entrepôt des marques'),
  ('Côté cacao')
ON CONFLICT DO NOTHING;

-- 3. Insertion des séparateurs Kanban
INSERT INTO kanban_dividers (status, label, position) VALUES
  ('a_faire',    'DEVIS', 0),
  ('a_faire',    'EN PRIORITÉ', 100),
  ('a_faire',    'SECONDAIRE', 1500),
  ('a_faire',    'EN ATTENTE RETOUR CLIENT', 1700),
  ('aujourdhui', 'IMPRESSION/DEVIS', 0),
  ('aujourdhui', 'CONCEPTION', 200),
  ('a_facturer', 'A FAIRE', 0),
  ('a_facturer', 'À ENVOYER', 1400),
  ('a_facturer', 'ENVOYÉ', 1500),
  ('a_facturer', 'IMPAYÉ', 1800);

-- 4. À FAIRE
WITH c AS (SELECT id, name FROM clients)
INSERT INTO tasks (title, prestation, status, priority, position, client_id) VALUES
  ('Étiquette',              'autre',       'a_faire', 'devis',                  200,  (SELECT id FROM c WHERE name='Caprice d''été')),
  ('Enseigne',               'creation',    'a_faire', 'en_priorite',            300,  (SELECT id FROM c WHERE name='GC Immobilier')),
  ('Carte',                  'mise_en_page','a_faire', 'en_priorite',            400,  (SELECT id FROM c WHERE name='Le 13')),
  ('Carte des vins',         'mise_en_page','a_faire', 'en_priorite',            500,  (SELECT id FROM c WHERE name='La Grève')),
  ('Carte vins',             'mise_en_page','a_faire', 'en_priorite',            600,  (SELECT id FROM c WHERE name='Atelier Rufo')),
  ('Carte',                  'mise_en_page','a_faire', 'en_priorite',            700,  (SELECT id FROM c WHERE name='Pergola')),
  ('Carte anglais - QR code','autre',       'a_faire', 'en_priorite',            800,  (SELECT id FROM c WHERE name='Pinsamisu')),
  ('Numéro de table',        'creation',    'a_faire', 'en_priorite',            900,  (SELECT id FROM c WHERE name='Vanille - Glacier')),
  ('Livret programmation',   'mise_en_page','a_faire', 'en_priorite',            1000, (SELECT id FROM c WHERE name='Medusor')),
  ('Logo',                   'creation',    'a_faire', 'en_priorite',            1100, (SELECT id FROM c WHERE name='Aéro')),
  ('Merch t-shirt',          'illustration','a_faire', 'en_priorite',            1200, (SELECT id FROM c WHERE name='Caprice d''été')),
  ('Logo',                   'refonte',     'a_faire', 'en_priorite',            1300, (SELECT id FROM c WHERE name='FMX Skipper')),
  ('Affiches',               'creation',    'a_faire', 'en_priorite',            1400, (SELECT id FROM c WHERE name='Huitres Aimé')),
  ('Visuel T-shirt',         'creation',    'a_faire', 'en_priorite',            1450, (SELECT id FROM c WHERE name='Maison Gomary')),
  ('Programmation',          'mise_en_page','a_faire', 'secondaire',             1600, (SELECT id FROM c WHERE name='Saint Moritz')),
  ('Plaquette Commerciale',  'mise_en_page','a_faire', 'attente_retour_client',  1800, (SELECT id FROM c WHERE name='La bazenne')),
  ('Projet épices',          'autre',       'a_faire', 'attente_retour_client',  1900, (SELECT id FROM c WHERE name='L''arrosoir')),
  ('Logo',                   'creation',    'a_faire', 'attente_retour_client',  2000, (SELECT id FROM c WHERE name='Vanille seul')),
  ('Logo',                   'creation',    'a_faire', 'attente_retour_client',  2100, (SELECT id FROM c WHERE name='Céleste')),
  ('Illustration murale',    'illustration','a_faire', 'attente_retour_client',  2200, (SELECT id FROM c WHERE name='Hôtel Les Bergers')),
  ('Dépliant',               'mise_en_page','a_faire', 'attente_retour_client',  2300, (SELECT id FROM c WHERE name='ETS Nougarede')),
  ('Projet livre',           'autre',       'a_faire', 'attente_retour_client',  2400, (SELECT id FROM c WHERE name='L''arrosoir'));

-- 5. AUJOURD'HUI
WITH c AS (SELECT id, name FROM clients)
INSERT INTO tasks (title, prestation, status, priority, position, client_id) VALUES
  ('Panneaux',            'impression',  'aujourdhui', 'secondaire', 100, (SELECT id FROM c WHERE name='DCAP17')),
  ('Magazine',            'mise_en_page','aujourdhui', 'secondaire', 300, (SELECT id FROM c WHERE name='Remax')),
  ('Stratégie de marque', 'autre',       'aujourdhui', 'secondaire', 400, (SELECT id FROM c WHERE name='Garden Restaurant'));

-- 6. FAIT
WITH c AS (SELECT id, name FROM clients)
INSERT INTO tasks (title, prestation, status, priority, position, client_id) VALUES
  ('Magazine',            'mise_en_page','envoye','secondaire', 100,  (SELECT id FROM c WHERE name='Le groupe immobilier')),
  ('Supports',            'autre',       'envoye','secondaire', 200,  (SELECT id FROM c WHERE name='Allez')),
  ('Carte',               'autre',       'envoye','secondaire', 300,  (SELECT id FROM c WHERE name='La sourie verte')),
  ('Logo',                'creation',    'envoye','secondaire', 400,  (SELECT id FROM c WHERE name='Daddy''s')),
  ('Enseigne',            'mise_en_page','envoye','secondaire', 500,  (SELECT id FROM c WHERE name='James Ice')),
  ('Panneaux Golfette',   'mise_en_page','envoye','secondaire', 600,  (SELECT id FROM c WHERE name='DCAP17')),
  ('Baseline',            'autre',       'envoye','secondaire', 700,  (SELECT id FROM c WHERE name='Pergola')),
  ('Carte',               'autre',       'envoye','secondaire', 800,  (SELECT id FROM c WHERE name='Caprice d''été')),
  ('Royan parachute',     'autre',       'envoye','devis',      900,  (SELECT id FROM c WHERE name='Atelier Rufo')),
  ('Logo',                'creation',    'envoye','devis',      1000, (SELECT id FROM c WHERE name='Atelier Rivage')),
  ('Cartes',              'mise_en_page','envoye','secondaire', 1100, (SELECT id FROM c WHERE name='Circus')),
  ('Carte de fidélité',   'mise_en_page','envoye','secondaire', 1200, (SELECT id FROM c WHERE name='Huitres Aimé')),
  ('Projet PERGOLA',      'autre',       'envoye','secondaire', 1300, (SELECT id FROM c WHERE name='L''arrosoir')),
  ('Supports',            'mise_en_page','envoye','secondaire', 1400, (SELECT id FROM c WHERE name='Medusor')),
  ('Carte',               'autre',       'envoye','secondaire', 1500, (SELECT id FROM c WHERE name='Atelier Rufo')),
  ('Cartes',              'mise_en_page','envoye','secondaire', 1600, (SELECT id FROM c WHERE name='O''café')),
  ('Carte de visite',     'autre',       'envoye','devis',      1700, (SELECT id FROM c WHERE name='Fetiveau Manone')),
  ('Plaquette',           'mise_en_page','envoye','secondaire', 1800, (SELECT id FROM c WHERE name='Maison Gomary')),
  ('Logo SNER',           'creation',    'envoye','devis',      1900, (SELECT id FROM c WHERE name='Allez')),
  ('T-shirts',            'creation',    'envoye','secondaire', 2000, (SELECT id FROM c WHERE name='BoMa')),
  ('Enveloppe',           'mise_en_page','envoye','devis',      2100, (SELECT id FROM c WHERE name='Leothémis')),
  ('ROC - Pelote basque', 'creation',    'envoye','secondaire', 2200, (SELECT id FROM c WHERE name='ROC')),
  ('Carte',               'mise_en_page','envoye','secondaire', 2300, (SELECT id FROM c WHERE name='La bazenne'));

-- 7. FACTURATION
WITH c AS (SELECT id, name FROM clients)
INSERT INTO tasks (title, prestation, status, priority, position, client_id) VALUES
  ('Flyer',               'autre',       'a_facturer','secondaire', 100,  (SELECT id FROM c WHERE name='O''café')),
  ('Panneau à vendre',    'impression',  'a_facturer','secondaire', 200,  (SELECT id FROM c WHERE name='Eric')),
  ('Enseigne',            'impression',  'a_facturer','secondaire', 300,  (SELECT id FROM c WHERE name='Vanille - Glacier')),
  ('Shooting',            'autre',       'a_facturer','secondaire', 400,  (SELECT id FROM c WHERE name='L''arrosoir')),
  ('Verre à eau',         'creation',    'a_facturer','secondaire', 500,  (SELECT id FROM c WHERE name='Maison Goulbi')),
  ('Carte de visite',     'autre',       'a_facturer','secondaire', 600,  (SELECT id FROM c WHERE name='La crique')),
  ('Bâches',              'mise_en_page','a_facturer','devis',      700,  (SELECT id FROM c WHERE name='Canela')),
  ('SDP26',               'autre',       'a_facturer','secondaire', 800,  (SELECT id FROM c WHERE name='Medusor')),
  ('EKIP 21',             'refonte',     'a_facturer','secondaire', 900,  (SELECT id FROM c WHERE name='Atelier Rufo')),
  ('Panneau menu',        'autre',       'a_facturer','devis',      1000, (SELECT id FROM c WHERE name='La Grève')),
  ('Panneau Immo',        'mise_en_page','a_facturer','secondaire', 1100, (SELECT id FROM c WHERE name='Leothémis')),
  ('Logotype',            'creation',    'a_facturer','secondaire', 1200, (SELECT id FROM c WHERE name='La piraterie')),
  ('Carte',               'mise_en_page','a_facturer','secondaire', 1300, (SELECT id FROM c WHERE name='La crique')),
  ('Flyers',              'impression',  'a_facturer','secondaire', 1600, (SELECT id FROM c WHERE name='Léothémis Amaury')),
  ('OBTP',                'creation',    'a_facturer','secondaire', 1700, (SELECT id FROM c WHERE name='OBTP')),
  ('Covering',            'autre',       'a_facturer','devis',      1750, (SELECT id FROM c WHERE name='Aurora Solutions')),
  ('Carte de visite',     'autre',       'a_facturer','secondaire', 1900, (SELECT id FROM c WHERE name='Steven Mourges'));
