-- Fix: role "authenticated" was missing INSERT and UPDATE on answers table,
-- causing students' quiz answers to silently fail to save (score always 0).
GRANT INSERT, UPDATE ON public.answers TO authenticated;
