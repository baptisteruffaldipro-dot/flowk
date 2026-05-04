-- Add new project_type enum values
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'identite_visuelle';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'rebranding';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'strategie_marque';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'logotype';