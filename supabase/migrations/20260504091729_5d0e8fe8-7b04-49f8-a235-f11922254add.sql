ALTER TABLE public.questionnaires
ADD COLUMN IF NOT EXISTS ai_suggested_tasks jsonb NOT NULL DEFAULT '[]'::jsonb;