-- Add 'impression' to task_status enum and migrate legacy statuses
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'impression';