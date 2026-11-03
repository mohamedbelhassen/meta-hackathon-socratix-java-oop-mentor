-- ============================================================================
-- SOCRATIX v2 - BASE PROFILES & SEED DATA (SYNCHRONIZED WITH PRODUCTION)
-- ============================================================================
-- All courses, chapters, and labs are imported & managed 100% via the
-- Teacher Dashboard (Course Studio) using real PDF files from _dev/java_course/
-- This seed provisions:
--   1. The 5 standard demo personas (Prof. Belhassen, Alice, Bob, Guest, Ines)
--   2. Verified teacher and student accounts for testing & jury evaluation
-- ============================================================================

INSERT INTO public.profiles (id, email, role, display_name, is_guest)
VALUES 
  -- Standard Demo Personas
  ('11111111-1111-1111-1111-111111111111', 'mohamed.belhassen@fsg.rnu.tn', 'teacher', 'Prof. Belhassen', false),
  ('22222222-2222-2222-2222-222222222222', 'alice.student@fsg.rnu.tn', 'student', 'Alice', true),
  ('33333333-3333-3333-3333-333333333333', 'bob.student@fsg.rnu.tn', 'student', 'Bob', true),
  ('44444444-4444-4444-4444-444444444444', NULL, 'student', 'Guest Explorer', true),
  ('55555555-5555-5555-5555-555555555555', 'ines.student@fsg.rnu.tn', 'student', 'Ines', true),

  -- Verified Accounts (Supabase Auth Registered)
  ('559cecbe-5c93-4c5f-8139-754d18be211b', 'abou.aziz.belhassen@gmail.com', 'teacher', 'Abou Aziz Belhassen', false),
  ('2dc07373-16c2-427c-99a2-5f0a0abce4d2', 'mohamed.belhassen@gmail.com', 'teacher', 'Teacher test account 2', false),
  ('0613a3c5-5596-4ded-ae46-d32a344ab298', 'mohamed.belhassen@fsg.u-gabes.tn', 'teacher', 'Belhassen (Teacher)', false),
  ('6eedc541-7c3b-472d-9b8e-88557fced711', 'abou.aziz.belhassen@outlook.fr', 'student', 'abou.aziz.belhassen', false)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  is_guest = EXCLUDED.is_guest;
