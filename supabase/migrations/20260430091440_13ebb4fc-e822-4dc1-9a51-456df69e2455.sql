
-- État du polling Telegram
CREATE TABLE public.telegram_bot_state (
  id INT PRIMARY KEY CHECK (id = 1),
  update_offset BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages telegram state" ON public.telegram_bot_state
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Utilisateurs Telegram autorisés
CREATE TABLE public.telegram_allowed_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_allowed_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages telegram users" ON public.telegram_allowed_users
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Conversations en cours (pour clarifications)
CREATE TABLE public.telegram_conversations (
  chat_id BIGINT PRIMARY KEY,
  pending_payload JSONB,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages telegram conversations" ON public.telegram_conversations
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
