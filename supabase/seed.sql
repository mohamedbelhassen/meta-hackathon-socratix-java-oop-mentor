-- ============================================================================
-- SOCRATIX - HACKATHON DEMO SEED DATA (FIXED UUIDs)
-- ============================================================================

-- 1. Insert Profiles (Teacher and 3 diverse students with fixed UUIDs)
INSERT INTO public.profiles (id, email, role, display_name) 
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'mohamed.belhassen@fsg.rnu.tn', 'teacher', 'Prof. Belhassen'),
  ('22222222-2222-2222-2222-222222222222', 'alice.dev@student.tn', 'student', 'Alice (Room A0-10 - PC 01)'),
  ('33333333-3333-3333-3333-333333333333', 'bob.learner@student.tn', 'student', 'Bob (Room A0-10 - PC 02)'),
  ('44444444-4444-4444-4444-444444444444', NULL, 'guest_student', 'Guest (Room A0-10 - PC 12)')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name;

-- 2. Insert an Active Lab Session
INSERT INTO public.lab_sessions (id, teacher_id, title, tp_code, is_active) 
VALUES 
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Lab 5: Encapsulation & Polymorphism', 'LAB5', true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_active = EXCLUDED.is_active;

-- 3. Insert Mock Telemetry Data (To populate the Teacher Dashboard matrix)
INSERT INTO public.student_competencies (
  student_id, lab_session_id, current_milestone, milestone_status, chapter, micro_concept, score_delta, mastery_score, last_diagnostic_note
) 
VALUES 
  -- Alice is doing great (COMPLETED)
  (
    '22222222-2222-2222-2222-222222222222', 
    '55555555-5555-5555-5555-555555555555', 
    'LAB5_ENCAPSULATION', 
    'COMPLETED', 
    'CH3_CLASSES', 
    'VISIBILITY_ENCAPSULATION', 
    20, 
    85, 
    'Perfectly implemented private attributes and getters.'
  ),
  
  -- Bob is struggling with Polymorphism (BLOCKED) - Shows up RED on dashboard
  (
    '33333333-3333-3333-3333-333333333333', 
    '55555555-5555-5555-5555-555555555555', 
    'LAB6_POLYMORPHISM', 
    'BLOCKED', 
    'CH4_INHERITANCE', 
    'POLYMORPHIC_ARRAY', 
    -15, 
    35, 
    'Trying to instantiate an abstract class (Felin) directly.'
  ),
  
  -- The Guest Student is currently working on it (IN_PROGRESS)
  (
    '44444444-4444-4444-4444-444444444444', 
    '55555555-5555-5555-5555-555555555555', 
    'LAB5_ENCAPSULATION', 
    'IN_PROGRESS', 
    'CH3_CLASSES', 
    'STATIC_MEMBERS', 
    5, 
    55, 
    'Forgot the static keyword on the item counter, but is asking good questions.'
  )
ON CONFLICT (student_id, lab_session_id, micro_concept) DO UPDATE SET
  current_milestone = EXCLUDED.current_milestone,
  milestone_status = EXCLUDED.milestone_status,
  score_delta = EXCLUDED.score_delta,
  mastery_score = EXCLUDED.mastery_score,
  last_diagnostic_note = EXCLUDED.last_diagnostic_note;

-- 4. Insert a sample Chat Session for Bob
INSERT INTO public.chat_sessions (id, student_id, lab_session_id) 
VALUES 
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Socratic Chat History for Bob
INSERT INTO public.chat_messages (session_id, role, content, code_snapshot) 
VALUES 
  (
    '66666666-6666-6666-6666-666666666666', 
    'user', 
    'Why is my array throwing an error when I add a Service? I thought they were both items.', 
    '[{"name": "YallaPOS.java", "content": "public class YallaPOS {\n  public static void main(String[] args) {\n    Article[] cart = new Article[10];\n    cart[0] = new Service(); // ERROR HERE\n  }\n}"}]'::jsonb
  ),
  (
    '66666666-6666-6666-6666-666666666666', 
    'assistant', 
    'I see you are trying to add a `Service` into an `Article` array. \n\nDo you remember the `DownloadManager` example from Slide 15 in Chapter 5? How did we group both `Document` and `Program` into a single array? \n\nWhat interface do both your `Article` and `Service` share that could be used as the array type?', 
    '{}'::jsonb
  );
