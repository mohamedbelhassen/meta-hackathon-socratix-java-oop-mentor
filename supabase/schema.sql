-- ============================================================================
-- SOCRATIX - COMPLETE SUPABASE SCHEMA (ENGLISH-READY)
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Handling Authenticated Teachers, Students, and Guest Students)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE, -- Nullable for guest_student mode
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'guest_student')),
    display_name TEXT NOT NULL, -- e.g., "Guest (Room A0-10 - PC 12)" or "Prof. Belhassen"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. LAB SESSIONS (Tracking the current TP / Lab)
CREATE TABLE IF NOT EXISTS public.lab_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL, -- e.g., "Lab 5: Encapsulation & Polymorphism"
    tp_code TEXT DEFAULT 'LAB5', -- e.g., "TP1".."TP12" or "LAB5"
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. STUDENT COMPETENCIES (The Live Telemetry Matrix)
CREATE TABLE IF NOT EXISTS public.student_competencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    lab_session_id UUID REFERENCES public.lab_sessions(id) ON DELETE CASCADE NOT NULL,
    
    -- Milestone tracking
    current_milestone TEXT NOT NULL, 
    milestone_status TEXT NOT NULL CHECK (
        milestone_status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'VALIDATED')
    ),
    
    -- Granular concept tracking (6 Chapters -> 20 Micro-competencies)
    chapter TEXT NOT NULL, -- e.g., "CH3_CLASSES", "CH4_INHERITANCE", "CH5_INTERFACES"
    micro_concept TEXT NOT NULL, -- e.g., "VISIBILITY_ENCAPSULATION"
    score_delta INTEGER DEFAULT 0 NOT NULL,
    mastery_score INTEGER DEFAULT 50 CHECK (mastery_score >= 0 AND mastery_score <= 100),
    last_diagnostic_note TEXT, -- e.g., "Missing private keyword on the price attribute."
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure exactly one record per student, per lab, per micro-concept (for UPSERT)
    CONSTRAINT unique_student_lab_concept UNIQUE(student_id, lab_session_id, micro_concept)
);

-- 4. CHAT SESSIONS (Grouping messages per student and lab)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    lab_session_id UUID REFERENCES public.lab_sessions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_student_lab_chat_session UNIQUE(student_id, lab_session_id)
);

-- 5. CHAT MESSAGES (Socratic History with targeted JSONB code snapshots)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'teacher_override')),
    content TEXT NOT NULL,
    code_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL, -- Stores ONLY the .java files inspected by the AI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 6. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_competencies_student ON public.student_competencies(student_id);
CREATE INDEX IF NOT EXISTS idx_competencies_lab ON public.student_competencies(lab_session_id);
CREATE INDEX IF NOT EXISTS idx_competencies_status ON public.student_competencies(milestone_status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_lookup ON public.chat_sessions(student_id, lab_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id);

-- ============================================================================
-- 7. AUTOMATIC UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_student_competencies_updated_at ON public.student_competencies;
CREATE TRIGGER update_student_competencies_updated_at
    BEFORE UPDATE ON public.student_competencies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. ENABLE SUPABASE REALTIME FOR THE TEACHER DASHBOARD
-- ============================================================================
ALTER TABLE public.student_competencies REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'student_competencies'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_competencies;
    END IF;
END $$;
