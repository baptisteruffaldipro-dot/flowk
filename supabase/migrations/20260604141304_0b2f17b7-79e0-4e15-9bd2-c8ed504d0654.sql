UPDATE public.social_tasks
SET status = 'aujourdhui'::public.social_task_status
WHERE status = 'en_cours'::public.social_task_status;

UPDATE public.social_tasks
SET status = 'archive'::public.social_task_status
WHERE status = 'fait'::public.social_task_status;