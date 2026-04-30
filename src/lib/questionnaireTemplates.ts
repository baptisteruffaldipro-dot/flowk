export type FieldType = "text" | "textarea" | "tags" | "select" | "multiselect";

export interface QField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  options?: string[];
  max?: number; // for tags / multiselect
}

export interface QSection {
  title: string;
  description?: string;
  fields: QField[];
}

export interface QTemplate {
  key: "logo" | "print" | "web" | "rapide";
  label: string;
  description: string;
  sections: QSection[];
}

export const QUESTIONNAIRE_TEMPLATES: Record<string, QTemplate> = {
  logo: {
    key: "logo",
    label: "Logo / Identité",
    description: "Brief complet pour création ou refonte de logo",
    sections: [
      {
        title: "Identité",
        fields: [
          { key: "logo_title", label: "Titre du logo (nom de l'organisation)", type: "text" },
          { key: "baseline", label: "Slogan à ajouter au logo (Baseline)", type: "text" },
        ],
      },
      {
        title: "Description de l'organisation et de son public cible",
        fields: [
          { key: "activity", label: "Activité", type: "text" },
          { key: "sector", label: "Secteur d'activité", type: "text" },
          { key: "products", label: "Services / produits", type: "textarea" },
        ],
      },
      {
        title: "Description de l'entreprise",
        fields: [
          { key: "essence", label: "Quelle est l'essence de votre entreprise ?", type: "textarea" },
          { key: "evolution", label: "Quels sont vos projets d'évolution ?", type: "textarea" },
          { key: "vision", label: "Comment vous voyez-vous dans 5 et 20 ans ?", type: "textarea" },
        ],
      },
      {
        title: "Mots-clés",
        fields: [
          {
            key: "negative_words",
            label: "3 mots que vous NE voulez PAS qu'on associe à votre identité",
            type: "tags",
            max: 3,
            help: "Appuyez sur Entrée après chaque mot",
          },
          {
            key: "positive_words",
            label: "3 mots que vous voulez qu'on associe à votre identité",
            type: "tags",
            max: 3,
          },
        ],
      },
      {
        title: "Avantages",
        description:
          "Une identité ne peut pas tout communiquer : il faut prioriser les objectifs de communication.",
        fields: [
          {
            key: "main_characteristics",
            label: "2 caractéristiques qui représentent le plus votre entreprise",
            type: "tags",
            max: 2,
          },
        ],
      },
      {
        title: "Problématiques",
        fields: [
          {
            key: "previous_issues",
            label:
              "En cas de refonte : problématiques des précédentes identités ? Aspects pertinents à conserver ?",
            type: "textarea",
          },
        ],
      },
      {
        title: "Style graphique",
        fields: [
          {
            key: "logotype_interest",
            label: "Êtes-vous intéressé(e) par un logotype ?",
            type: "select",
            options: ["Oui, uniquement typographique", "Oui, avec symbole", "Symbole seul", "Indifférent"],
          },
          {
            key: "avoid_aspects",
            label: "Aspects de votre entreprise à estomper ou éviter dans l'identité ?",
            type: "textarea",
          },
        ],
      },
      {
        title: "Votre cible",
        fields: [
          {
            key: "target_audience",
            label: "Décrivez votre public principal. Changera-t-il avec le temps ?",
            type: "textarea",
          },
          { key: "competitors", label: "Principaux concurrents", type: "textarea" },
        ],
      },
      {
        title: "Avantage concurrentiel",
        fields: [
          {
            key: "differentiation",
            label: "Qu'est-ce qui vous différencie ? En quoi êtes-vous supérieurs ?",
            type: "textarea",
          },
          {
            key: "inspiration",
            label:
              "2 identités graphiques (une dans, une hors de votre secteur) que vous aimez. Pourquoi ?",
            type: "textarea",
          },
          {
            key: "recommendations",
            label: "Dernières recommandations ? Clichés à éviter ?",
            type: "textarea",
          },
          {
            key: "supports",
            label: "Supports sur lesquels le logo apparaîtra (carte de visite, enseigne, flyer...)",
            type: "textarea",
          },
        ],
      },
    ],
  },
  print: {
    key: "print",
    label: "Projet Print",
    description: "Brief pour un projet d'impression (flyer, affiche, brochure...)",
    sections: [
      {
        title: "Le support",
        fields: [
          { key: "support_type", label: "Type de support", type: "text", placeholder: "Flyer, affiche, brochure..." },
          { key: "format", label: "Format", type: "text", placeholder: "A4, A5, 10x21..." },
          { key: "quantity", label: "Quantité", type: "text" },
          { key: "paper", label: "Papier / grammage souhaité", type: "text" },
          { key: "finishings", label: "Finitions (pelliculage, vernis, dorure...)", type: "text" },
        ],
      },
      {
        title: "Contenu",
        fields: [
          { key: "purpose", label: "Objectif du support", type: "textarea" },
          { key: "key_message", label: "Message principal à faire passer", type: "textarea" },
          { key: "content", label: "Contenu textuel à intégrer (ou à rédiger ?)", type: "textarea" },
          { key: "images", label: "Images / visuels disponibles ?", type: "textarea" },
        ],
      },
      {
        title: "Style et cible",
        fields: [
          { key: "audience", label: "À qui s'adresse ce support ?", type: "textarea" },
          { key: "tone", label: "Ton souhaité", type: "text", placeholder: "Sérieux, fun, premium..." },
          { key: "references", label: "Références visuelles / inspirations", type: "textarea" },
          { key: "constraints", label: "Contraintes graphiques (charte, couleurs imposées...)", type: "textarea" },
        ],
      },
      {
        title: "Diffusion",
        fields: [
          { key: "distribution", label: "Comment sera-t-il diffusé ?", type: "textarea" },
          { key: "deadline", label: "Date limite de livraison", type: "text" },
        ],
      },
    ],
  },
  web: {
    key: "web",
    label: "Projet Web",
    description: "Brief pour un site web ou une application web",
    sections: [
      {
        title: "Le projet",
        fields: [
          { key: "project_type", label: "Type de site", type: "select", options: ["Vitrine", "E-commerce", "Application web", "Landing page", "Blog", "Autre"] },
          { key: "project_name", label: "Nom du projet / domaine envisagé", type: "text" },
          { key: "current_site", label: "Site actuel (si refonte) - URL", type: "text" },
          { key: "objectives", label: "Objectifs principaux", type: "textarea" },
        ],
      },
      {
        title: "Contenu et fonctionnalités",
        fields: [
          { key: "pages", label: "Pages / sections à prévoir", type: "textarea" },
          { key: "features", label: "Fonctionnalités spécifiques (formulaire, paiement, espace membre...)", type: "textarea" },
          { key: "content_ready", label: "Contenu disponible ? Ou à rédiger ?", type: "textarea" },
          { key: "languages", label: "Langues du site", type: "text" },
        ],
      },
      {
        title: "Cible et identité",
        fields: [
          { key: "target", label: "Public cible", type: "textarea" },
          { key: "tone", label: "Ton et personnalité", type: "text" },
          { key: "branding", label: "Identité visuelle existante ? À créer ?", type: "textarea" },
          { key: "inspirations", label: "Sites qui vous inspirent (avec URLs)", type: "textarea" },
          { key: "avoid", label: "Sites ou éléments à éviter", type: "textarea" },
        ],
      },
      {
        title: "Technique",
        fields: [
          { key: "hosting", label: "Hébergement actuel ou souhaité", type: "text" },
          { key: "integrations", label: "Intégrations tierces (CRM, newsletter, analytics...)", type: "textarea" },
          { key: "seo", label: "Attentes SEO / visibilité", type: "textarea" },
          { key: "deadline", label: "Date de mise en ligne souhaitée", type: "text" },
          { key: "budget", label: "Budget envisagé (optionnel)", type: "text" },
        ],
      },
    ],
  },
  rapide: {
    key: "rapide",
    label: "Projet Rapide",
    description: "Brief express pour une demande simple ou urgente",
    sections: [
      {
        title: "L'essentiel",
        fields: [
          { key: "request", label: "Que souhaitez-vous ? (description courte)", type: "textarea" },
          { key: "purpose", label: "À quoi cela va servir ?", type: "textarea" },
          { key: "deadline", label: "Pour quand ?", type: "text" },
          { key: "format", label: "Format / dimensions / support", type: "text" },
          { key: "tone", label: "Ton ou style souhaité", type: "text" },
          { key: "references", label: "Références ou exemples", type: "textarea" },
          { key: "extras", label: "Autres précisions", type: "textarea" },
        ],
      },
    ],
  },
};

export const TEMPLATE_OPTIONS = Object.values(QUESTIONNAIRE_TEMPLATES).map((t) => ({
  value: t.key,
  label: t.label,
  description: t.description,
}));
