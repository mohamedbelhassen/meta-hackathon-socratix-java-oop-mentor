-- ============================================================================
-- SOCRATIX v2 - COMPLETE SUPABASE SCHEMA (MULTI-COURSE & REALTIME ERP)
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DROP OBSOLETE & LEGACY TABLES (IDEMPOTENT MIGRATION)
DROP TABLE IF EXISTS public._test_mcp CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_sessions CASCADE;
DROP TABLE IF EXISTS public.student_competencies CASCADE;
DROP TABLE IF EXISTS public.student_lab_sessions CASCADE;
DROP TABLE IF EXISTS public.labs CASCADE;
DROP TABLE IF EXISTS public.lab_sessions CASCADE;
DROP TABLE IF EXISTS public.course_chapters CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. PROFILES (Pure identity table without volatile seat_label)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
    is_guest BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. COURSES (Generic multi-course definition)
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL, -- e.g., 'JAVA_OOP', 'PARSE_PLATFORM'
    title TEXT NOT NULL, -- e.g., 'Programmation Orientée Objet (Java)'
    description TEXT,
    content_language TEXT NOT NULL DEFAULT 'fr',
    tutor_language TEXT NOT NULL DEFAULT 'en',
    file_extensions TEXT[] NOT NULL DEFAULT ARRAY['.java'],
    stuck_threshold_turns INTEGER NOT NULL DEFAULT 2,
    competency_matrix JSONB NOT NULL DEFAULT '[]'::jsonb,
    compiled_tutor_prompt TEXT NOT NULL DEFAULT '',
    compiled_knowledge_base TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. COURSE CHAPTERS (Paged course materials linked to Supabase Storage PDFs)
CREATE TABLE public.course_chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    chapter_number INTEGER NOT NULL,
    code TEXT NOT NULL, -- e.g., 'CH1_INTRO', 'CH3_CLASSES'
    title TEXT NOT NULL,
    title_i18n JSONB, -- { en: string, fr: string }
    pdf_url TEXT,
    markdown_content TEXT NOT NULL DEFAULT '',
    pages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_analogies JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_course_chapter UNIQUE(course_id, code)
);

-- 5. LABS (Hierarchical lab exercises, milestones, and coverage)
CREATE TABLE public.labs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    lab_number INTEGER NOT NULL,
    code TEXT NOT NULL, -- e.g., 'TP1', 'TP5', 'TP12'
    title TEXT NOT NULL,
    title_i18n JSONB, -- { en: string, fr: string }
    description TEXT,
    pdf_url TEXT,
    pages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    activities JSONB NOT NULL DEFAULT '[]'::jsonb,
    covered_micro_concepts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    demo_presets JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_course_lab UNIQUE(course_id, code)
);

-- 6. STUDENT LAB SESSIONS (Single consolidated row per student per lab)
CREATE TABLE public.student_lab_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    lab_id UUID REFERENCES public.labs(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Physical location for this specific session
    seat_label VARCHAR(60) NOT NULL DEFAULT 'Room A0-10 - PC 12',
    
    -- Progression and deterministic status
    status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED')),
    current_activity_id TEXT,
    current_milestone_id TEXT,
    completed_milestone_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    activities_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
    progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    
    -- Multi-occurrence competency telemetry state
    micro_competencies_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_diagnostic_note TEXT,
    completion_report JSONB,
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_stuck_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    CONSTRAINT unique_student_per_lab UNIQUE(student_id, lab_id)
);

-- 7. CHAT MESSAGES (Cascades on student_lab_session deletion for 1-query purge)
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_lab_session_id UUID REFERENCES public.student_lab_sessions(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'teacher_hint')),
    content TEXT NOT NULL,
    course_reference JSONB,
    code_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 8. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX idx_courses_teacher ON public.courses(teacher_id);
CREATE INDEX idx_courses_code ON public.courses(code);
CREATE INDEX idx_course_chapters_course ON public.course_chapters(course_id, chapter_number);
CREATE INDEX idx_labs_course ON public.labs(course_id, lab_number);
CREATE INDEX idx_student_lab_sessions_lookup ON public.student_lab_sessions(course_id, lab_id);
CREATE INDEX idx_student_lab_sessions_student ON public.student_lab_sessions(student_id);
CREATE INDEX idx_student_lab_sessions_status ON public.student_lab_sessions(status);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(student_lab_session_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);

-- ============================================================================
-- 9. AUTOMATIC UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_lab_sessions_updated_at
    BEFORE UPDATE ON public.student_lab_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 10. AUTH SYNC TRIGGER (auth.users -> public.profiles)
-- ============================================================================
-- Automatically provisions or updates public.profiles whenever a user signs up
-- in Supabase Auth (auth.users). Dual-layer resilience is ensured with the Next.js
-- server endpoint /api/auth/sync-profile.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, role, is_guest)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
        role = COALESCE(EXCLUDED.role, public.profiles.role);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- 11. SUPABASE STORAGE BUCKET (course-pdfs)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'course-pdfs',
    'course-pdfs',
    true,
    52428800, -- 50 MB
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf'];

-- Storage access policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for course-pdfs'
    ) THEN
        CREATE POLICY "Public Access for course-pdfs"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'course-pdfs');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Upload for course-pdfs'
    ) THEN
        CREATE POLICY "Public Upload for course-pdfs"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id = 'course-pdfs');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Update for course-pdfs'
    ) THEN
        CREATE POLICY "Public Update for course-pdfs"
            ON storage.objects FOR UPDATE
            USING (bucket_id = 'course-pdfs');
    END IF;
END $$;

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_lab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow read for everyone (Anon & Auth)
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public read courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public read course_chapters" ON public.course_chapters FOR SELECT USING (true);
CREATE POLICY "Public read labs" ON public.labs FOR SELECT USING (true);
CREATE POLICY "Public read student_lab_sessions" ON public.student_lab_sessions FOR SELECT USING (true);
CREATE POLICY "Public read chat_messages" ON public.chat_messages FOR SELECT USING (true);

-- Allow full mutations for authenticated users and anonymous testing / server API routes
CREATE POLICY "Allow all mutations profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations course_chapters" ON public.course_chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations labs" ON public.labs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations student_lab_sessions" ON public.student_lab_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 13. ENABLE SUPABASE REALTIME
-- ============================================================================
ALTER TABLE public.student_lab_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'student_lab_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_lab_sessions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
END $$;
