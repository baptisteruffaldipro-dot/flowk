-- Add reminder columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN reminder_minutes_before integer DEFAULT NULL,
  ADD COLUMN reminder_sent_at timestamptz DEFAULT NULL;