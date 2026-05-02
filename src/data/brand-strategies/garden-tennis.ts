import type { BrandStrategy } from "./types";

export const gardenTennisStrategy: BrandStrategy = {
  slug: "garden-tennis-royan",
  client: "Garden Tennis de Royan",
  projectName: "Stratégie de marque — Restaurant Garden Tennis de Royan",
  version: "Document de travail — Version 1",
  tagline: "Un restaurant entre les courts et la Gironde.",

  positioning:
    "Un restaurant entre les courts de tennis et la Gironde — une cuisine qui compte, dans un lieu qui se vit.",

  promise: {
    headline: "Le restaurant que Royan méritait toute l'année.",
    before:
      "Il choisit par défaut en saison, qualité introuvable au calme. Par dépit hors saison, presque plus rien d'ouvert.",
    after:
      "Il a trouvé son endroit. Il recommande, revient, amène ses invités — en juillet comme en novembre.",
  },

  signature: {
    signature: "Plus qu'un restaurant, un lieu.",
    thread: "Un agenda, pas juste une carte.",
  },

  storytelling: {
    title: "Le Garden, une histoire qui recommence",
    paragraphs: [
      "En 1912, au bord de la Gironde, naît le Garden Tennis de Royan. Pas juste un club, un lieu de vie. Dès 1930, la Fédération Française de Tennis le décrit ainsi : « Vue magnifique sur la mer, les plus beaux jardins et pergolas de la Côte d'Argent. » Il y avait déjà un bar américain, des fêtes mémorables, une sensation de liberté que tous ceux qui franchissaient le porche du boulevard Carnot ont un jour ressentie.",
      "Pendant un siècle, le Garden a traversé les époques. Il est devenu l'un des rares clubs centenaires au monde. Mais quelque chose manquait : une vraie table, un endroit où prolonger le moment autrement que sur les courts.",
      "Christelle et Lola n'osaient pas y rentrer. Trop fermé, pensaient-elles, comme beaucoup de Royannais. Le jour où elles ont franchi le porche, le coup de cœur a été immédiat. Deux ans de chantier, d'obstacles, de reprise en main, un projet construit à la force du poignet et en famille.",
      "Elles qui avaient ressenti la barrière de l'extérieur sont aujourd'hui celles qui ouvrent les portes. Ce restaurant, c'est la promesse que le Garden redevient ce qu'il a toujours voulu être : un lieu ouvert sur la mer, sur la vie, sur les autres.",
    ],
    pullQuote: "Depuis 1912, vue magnifique sur la mer.",
    proof: {
      tells: "Un lieu qu'on a apprivoisé pour mieux l'ouvrir aux autres.",
      proves: "L'authenticité du projet et la sincérité de la promesse d'ouverture.",
      useFor: "Page À propos, presse, lancement réseaux sociaux.",
    },
  },

  pillars: [
    { name: "Le cadre", description: "Vue Gironde, courts vivants, lieu iconique de Royan." },
    { name: "La cuisine", description: "Produits locaux, de saison, sans ostentation." },
    { name: "Le service", description: "Chaleureux, décontracté, standing sans raideur." },
    { name: "La vie du lieu", description: "Concerts, brasero, jeux, tournois. Un réel agenda." },
  ],

  signatureMoments: [
    {
      index: "01",
      title: "Le piano du soir",
      when: "Toute l'année",
      intro: "Fond sonore assumé. Le détail que les clients mentionnent en premier.",
      lives: "Une atmosphère qui fait oublier qu'on est dans un restaurant.",
      tells: "« Il y avait un pianiste en live, c'était très agréable. »",
      role: "Fidélité — ce qui fait revenir hors saison.",
      quote: "L'endroit où même le fond sonore est pensé pour être agréable.",
    },
    {
      index: "02",
      title: "Le brasero face à la Gironde",
      when: "Été",
      intro: "Cuisson au feu en terrasse. Le moment qu'on anticipe et qu'on raconte.",
      lives: "Un repas qui a une âme — le feu, la vue, le partage autour de la cuisine.",
      tells: "« On a mangé au brasero face à la mer, c'était quelque chose. »",
      role: "Désir — le moment rare qu'on réserve et qu'on raconte.",
      quote: "Le feu, la viande, la Gironde. Pas besoin d'en dire plus.",
    },
    {
      index: "03",
      title: "Le QG du tournoi",
      when: "Événements tennis",
      intro: "Joueurs et public qui prolongent l'énergie du match autour d'une table.",
      lives: "L'adrénaline du tournoi prolongée autour d'une table.",
      tells: "« Après le match on est allés au resto du Garden, super ambiance. »",
      role: "Notoriété — porte d'entrée pour de nouveaux clients.",
      quote: "Le match est fini. La soirée commence ici.",
    },
  ],

  voice: {
    is: [
      "Chaleureuse",
      "Décontractée",
      "Pétillante",
      "Vivante",
      "Minimaliste",
      "Standing léger",
      "Enveloppante",
    ],
    isNot: [
      "Snack de bord de mer",
      "Table gastro intimidante",
      "Annexe du club de tennis",
      "Lieu vieillissant",
      "Clientèle non dynamique",
    ],
  },

  swot: {
    strengths: [
      { title: "Cadre unique et non reproductible", detail: "Vue Gironde + courts, personne d'autre à Royan." },
      { title: "Lieu iconique, notoriété existante", detail: "Le Garden travaille avant même l'ouverture." },
      { title: "Piano live toute l'année", detail: "Signal fort d'un lieu qui vit hors saison." },
      { title: "Formation Bocuse + expérience hôtelière", detail: "Crédibilité cuisine et gestion." },
      { title: "Histoire authentique mère-fille", detail: "Projet familial sincère, les clients le sentent." },
    ],
    weaknesses: [
      { title: "Première saison sans image de marque", detail: "Tout reste à installer." },
      { title: "Marges financières limitées au lancement", detail: "Dépendance au CA pour investir." },
      { title: "Confusion possible à l'entrée", detail: "Réputation « fermé » à déconstruire, signalétique clé." },
      { title: "Personnel à recruter et former", detail: "Le service est un pilier, risque humain réel." },
      { title: "Identité de marque inexistante", detail: "Nom, visuel, communication — tout à créer." },
    ],
    opportunities: [
      { title: "Été saturé, qualité introuvable au calme", detail: "Le recours pour ceux qui cherchent autre chose." },
      { title: "CSP+ locaux sans lieu de référence", detail: "Clientèle qui existe, cherche, et fidélise vite." },
      { title: "Hors saison : quasi aucune concurrence", detail: "Devenir le lieu de référence des locaux toute l'année." },
      { title: "Tournois tennis — levier d'acquisition", detail: "Flux de nouveaux clients captifs." },
      { title: "Agenda culturel comme différenciant fort", detail: "Aucun concurrent ne propose ça dans ce registre." },
    ],
    threats: [
      { title: "Contraintes mairie et site sportif", detail: "Alcool, bruit, Thalazur — limites opérationnelles réelles." },
      { title: "Événements tennis perturbateurs", detail: "Risque si le resto subit les tournois au lieu de les porter." },
      { title: "Saisonnalité de Royan", detail: "Équilibre fragile si la clientèle hors saison ne se construit pas." },
      { title: "Image « annexe du tennis » difficile à effacer", detail: "Sans marque forte, le resto reste « le resto du Garden »." },
      { title: "Recrutement en zone touristique", detail: "Personnel qualifié difficile à fidéliser hors saison." },
    ],
  },

  naming: {
    intro: "Trois stratégies en parallèle.",
    strategies: [
      {
        code: "A",
        title: "L'héritage capté",
        description:
          "Garder « Garden » dans le nom. La notoriété du lieu travaille immédiatement. Le qualificatif doit être suffisamment fort pour imposer sa propre personnalité.",
        directions: [
          {
            name: "Le Garden",
            signatures: ["Plus qu'un restaurant, un lieu.", "La table vivante de Royan."],
          },
          {
            name: "La Table du Garden",
            signatures: [
              "Cuisine de saison, piano live & vue sur la Gironde.",
              "La table des beaux moments à Royan.",
            ],
          },
          {
            name: "Garden Riva",
            signatures: ["Cuisine, vue & beaux soirs sur l'estuaire.", "La dolce vita face à la Gironde."],
          },
        ],
        explorations: [
          "French Garden", "Garden Océan", "Garden Time", "Garden House", "Garden Place",
          "Les Terrasses du Garden", "Garden terrasse", "Garden moment", "Garden rivage",
          "Garden riviera", "Le jardin des saveurs", "Garden Riva",
        ],
      },
      {
        code: "B",
        title: "L'identité propre",
        description:
          "Nom nouveau, sans lien avec Garden. Notoriété à construire de zéro, mais marque entièrement autonome.",
        directions: [
          {
            name: "Le Balcon de l'Estuaire",
            signatures: [
              "La table vivante face à la Gironde.",
              "Cuisine de saison avec vue sur les beaux soirs.",
              "L'adresse suspendue entre Royan et l'estuaire.",
            ],
          },
          {
            name: "Maison Rivage",
            signatures: [
              "Une maison ouverte sur la mer, toute l'année.",
              "Cuisine de saison, piano live & vue sur l'estuaire.",
              "La table des beaux moments à Royan.",
            ],
          },
          {
            name: "L'Échappée",
            signatures: [
              "Cuisine, vue & parenthèse au grand air.",
              "Une table ouverte sur la Gironde.",
              "Le goût des beaux jours, toute l'année.",
            ],
          },
        ],
        explorations: [
          "Guetami", "Jardin sur mer", "Vue sur mer", "Rivage", "L'Azurée", "Le Grand Large",
          "BELLEVUE", "Maison Guette-Amy", "Au Grand Air", "Guetlami",
        ],
      },
      {
        code: "C",
        title: "L'identité liée au Tennis",
        description: "Clin d'œil au tennis, ancré dans le bord de mer.",
        directions: [
          {
            name: "CARRÉ MER",
            signatures: [
              "La table côté court, vue côté mer.",
              "Cuisine de saison entre courts et estuaire.",
              "Le rendez-vous frais, vivant et iodé de Royan.",
            ],
          },
          {
            name: "Set & Mer",
            signatures: [
              "La table côté court, l'esprit côté mer.",
              "Cuisine, tennis & beaux moments face à l'estuaire.",
              "Après le match, la mer à table.",
            ],
          },
        ],
        explorations: ["Carré", "Service", "Break", "Ace", "Set", "Le Revers", "Set sur Mer"],
      },
    ],
  },

  todo: [
    "Naming final — trancher entre Stratégie A, B et C",
    "Territoire visuel — couleurs, typographie, univers graphique",
    "Persona affiné — profil client détaillé avec prénom et vie",
    "Plan de communication lancement",
    "Moodboard — deux univers à explorer",
    "Système de logos — principal, secondaire, submark",
    "Système typographique — primaire, secondaire, soutien",
    "Palette chromatique — primaire et neutres",
    "Mises en situation — in situ",
  ],
};
