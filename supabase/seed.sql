-- ============================================================================
-- SOCRATIX v2 - BASE PROFILES SEED (ZERO HARDCODED COURSES)
-- ============================================================================
-- All courses, chapters, and labs are imported & managed 100% via the
-- Teacher Dashboard (Course Studio) using real PDF files from _dev/java_course/
-- ============================================================================

INSERT INTO public.profiles (id, email, role, display_name, is_guest)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'mohamed.belhassen@fsg.rnu.tn', 'teacher', 'Prof. Belhassen', false),
  ('22222222-2222-2222-2222-222222222222', 'alice.student@fsg.rnu.tn', 'student', 'Alice', true),
  ('33333333-3333-3333-3333-333333333333', 'bob.student@fsg.rnu.tn', 'student', 'Bob', true),
  ('44444444-4444-4444-4444-444444444444', NULL, 'student', 'Guest Explorer', true),
  ('55555555-5555-5555-5555-555555555555', 'ines.student@fsg.rnu.tn', 'student', 'Ines', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  is_guest = EXCLUDED.is_guest;
