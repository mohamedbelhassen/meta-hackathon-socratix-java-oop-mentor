# Socratix 🦉
**Zero-Install Socratic AI Mentor & Pedagogical ERP for Programming Classrooms**

![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-black)
![Meta AI](https://img.shields.io/badge/Meta_Model_API-muse--spark--1.3-0668E1)
![Supabase](https://img.shields.io/badge/Supabase-Realtime_%26_PostgreSQL-3ECF8E)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x_Strict-3178C6)
![License](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue)

> **Live Production App:** [https://socratix-mentor.vercel.app](https://socratix-mentor.vercel.app)  
> Built for the **Meta Global AI Developer Hackathon** (*Track: Build for Your World*) by **Mohamed Belhassen** — Computer Science Lecturer at the **Faculty of Sciences of Gabès (FSG), Tunisia**.

---

## 🚨 The Classroom Problem

In university programming labs, generic AI assistants create two structural failures:
1. **The "Answer Engine" Trap:** Chatbots rewrite entire files on demand. Students copy-paste working code without building mental models of encapsulation, polymorphism, semantic markup, or CSS specificity.
2. **Instructor Blindness Across 25+ Workstations:** During a 2-hour practical session, a lecturer cannot tell whether a quiet room means steady progress or six students silently stuck on the exact same milestone—nor which lecture concepts lack practical lab coverage.
3. **Locked Campus PCs & Cross-Lingual Friction:** University lab machines forbid installing local CLI daemons, Docker containers, or IDE plugins, while slides are often authored in French whereas code and technical documentation live in English.

---

## 💡 The Solution: Socratix (Pedagogical ERP)

**Socratix** is a **course-agnostic, zero-install web platform** that turns any instructor's raw lecture slide PDFs and lab sheets into:
1. **A Zero-Install Socratic Student Workspace (`/student`)** connected directly to the student's local IDE folder via the browser's native **File System Access API**—guiding students in 80–110 words, citing exact course slides in a **3-Mode Smart Slide Viewer**, and refusing to leak solution code.
2. **A Real-Time 4-Tab Teacher ERP Hub (`/teacher`)** featuring live WebSocket workstation telemetry, automatic **Classroom Bottleneck Alerts**, cohort **Class Analytics**, design-time **Curriculum Coverage Matrices**, and a self-service **AI Course Studio**.

Currently live in production with **two authentic university curricula** from FSG:
- **Object-Oriented Programming in Java (`JAVA_OOP`)** — `.java`
- **Introduction to Web Development (`HTML_CSS`)** — `.html`, `.css` *(7 French lecture chapters across HTML5 & CSS3 modules mentored seamlessly in English)*

---

## ✨ Key Features

### For students — `/student`
- **Socratic, never a solution dispenser:** four modes (**Ask**, **`💡 Hint`**, **`📖 Concept`**, **`🧪 Check`**), replies capped at 80–110 words, each grounded in a cited lecture slide.
- **3-Mode Smart Slide Viewer:** Clean English, Official PDF (exact page), Clean French. Slides that were never translated are translated **just-in-time** by `muse-spark-1.3` and cached for the whole class.
- **Course-driven tutoring language (`tutor_language`):** The mentor dynamically follows each course's configured language (e.g. English mentoring over French slides, or French over French), permanently enforced across the system prompt, strict JSON schema, and runtime validation layers without language drift.
- **In-situ course library:** the official lab sheet (**`Lab PDF ↗`**) and every lecture chapter are one click away, without leaving the code or the conversation.
- **Milestone celebration & Competency Report Card** generated when all milestone contracts are verified in the target files.

### For teachers — `/teacher` (4-tab ERP)
- **📡 Live Lab Sessions:** real-time `BLOCKED` / `IN_PROGRESS` / `COMPLETED` matrix, automatic **Classroom Bottleneck Alerts**, `file:location` drill-downs, live code & chat inspector, and a one-click **Milestone Breakdown** per student (mastered, active and pending milestones with their validation criteria).
- **Remediation-aware mastery:** once an activity is completed, concepts the student failed earlier turn **Mastered — acquired after remediation**, while every original attempt stays visible to the teacher.
- **📊 Class Analytics:** milestone funnels, friction rankings and cohort mastery, per lab or course-wide.
- **🧭 Curriculum Coverage:** coverage health score, theory-only gaps and unanchored practical competencies.
- **🧠 Course Studio:** raw PDFs to a ready-to-teach course, with a non-blocking batch queue (auto-retry, **Retry Failed**) and targeted per-lab re-analysis.

---

## 🧠 Six Purpose-Built Layers of Meta AI (`muse-spark-1.3`)

Instead of relying on a single monolithic prompt, Socratix pairs **deterministic client/server algorithms** with **six specialized `muse-spark-1.3` pipelines**:

| Layer | Route / Module | Deterministic Engineering | Meta AI (`muse-spark-1.3`) Capability |
| :--- | :--- | :--- | :--- |
| **1. Holistic Pre-Flight & Staging** | `/api/studio/chapters-preflight`<br>`/api/studio/labs-preflight` | Client-side `pdfjs-dist` extracts Page 1 in `<50ms` with zero upload wait. | Infers global pedagogical order across multi-module courses (resolving naming collisions like `ch1_html` vs. `ch1_css`), predicts `target_files`, and extracts a **verbatim `source_quote`** displayed in a **Human-in-the-Loop Staging Modal**. |
| **2. Bilingual Slide Distillation** | `/api/studio/chapter-analyze`<br>`/api/studio/translate-slide`<br>`lib/pdf-cleaner.ts` | Statistical perimeter cleaner strips recurring PDF headers, footers, and logos; JIT translations are persisted atomically in `course_chapters.pages_json`. | Distills slide batches (`10 slides/chunk`) into clean **FR + EN Markdown** while keeping code identifiers (`private`, `setPrice`, `<form>`) intact, plus chapter-level analogies; translates any missing slide **just-in-time** on first view. |
| **3. 2-Pass Full-Text Synthesis** | `/api/studio/compile-taxonomy`<br>`/api/studio/compile-prompt` | Preserves **100% integral chapter Markdown** (zero truncation) within serverless timeouts; preserves existing competency IDs across recompiles. | **Pass 1** extracts a deduplicated `SCREAMING_SNAKE_CASE` competency matrix with semantic aliases; **Pass 2** authors course-specific Socratic anchoring rules & few-shot examples in the course's tutoring language. |
| **4. Lab Decomposition & Presets** | `/api/studio/lab-analyze` | Enforces sequential milestone IDs and role-based solution hiding; 2-attempt retry with backoff and dynamic PDF context budget. | Decomposes lab PDFs into activities, verifiable milestones, bilingual briefs, and **2 presets for every activity** (`Buggy` student mistake + complete, compilable `JURY` reference solution), carrying code forward across activities that edit the same file. |
| **5. Real-Time Socratic Mentor** | `/api/tutor`<br>`lib/prompt-builder.ts` | Escapes XML tags against prompt injection; verifies `target_files`; resolves canonical slide markdown & PDF URLs; permanent tutoring-language layer. | Leverages **24h Prefix KV Caching** (`prompt_cache_key`, `prompt_cache_retention: "24h"`), `reasoning_effort: "low"`, and **runtime-compiled strict `json_schema` enums** (`buildDynamicSocratixSchema`) so hallucinated IDs are structurally impossible. |
| **6. Silent Multi-Occurrence Telemetry** | `lib/telemetry-merger.ts`<br>Supabase Realtime | Non-destructive merge tracking `PASS`/`FAIL` per `file:location`; reconciles overcome failures into **remediated mastery** on completion; stores targeted `JSONB` snapshots (`inspected_files` only). | Emits structured per-turn diagnostic notes, micro-competency evaluations, and milestone **Competency Report Cards** in a single inference round-trip. |

---

## 🏗️ System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. SELF-SERVICE COURSE STUDIO (/teacher -> Course Studio)                    │
│ Raw PDFs ──► Client pdfjs (<50ms Page 1) ──► Pre-Flight + Grounding Quote    │
│          ──► Perimeter Cleaner + Bilingual Slide Distillation (FR & EN)      │
│          ──► 2-Pass Full-Text Synthesis (Taxonomy Matrix + Socratic Prompt)  │
│          ──► Lab Decomposition (Activities + Milestones + Buggy/JURY Presets)│
│          ──► Non-blocking batch queue · auto-retry · per-lab re-analysis     │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────┐    POST /api/tutor     ┌──────────────────────┐
│ 2. STUDENT WORKSPACE         │ ─────────────────────► │ Next.js App Router   │
│ (/student)                   │  Code + Mode (Ask /    │ • Rate Limiter & Auth│
│ • File System Access API     │  Hint / Concept /Check)│ • XML Escape │
│   (IndexedDB F5 Persistence) │                        │ • Dynamic JSON Schema│
│ • 3-Mode Smart Slide Viewer  │ ◄───────────────────── │ • Meta muse-spark-1.3│
│   (Clean EN | PDF | Clean FR)│  Socratic Reply +      │   (24h Prefix Cache) │
│ • Milestone Report Card 🏆   │  Canonical Slide + 🏆  └──────────┬───────────┘
└──────────────────────────────┘                                   │
                                           Upsert Telemetry +      │
                                           Targeted JSONB Snapshot │
                                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 3. TEACHER ERP HUB (/teacher) ◄── Supabase Realtime (postgres_changes & sync)│
│ • Live Lab Sessions: Red BLOCKED / Green COMPLETED + Bottleneck Alerts       │
│ • Occurrence Drill-Down (file:location) + On-Demand Live Workspace Dump      │
│ • Per-Student Milestone Breakdown + Remediation-Aware Mastery                │
│ • Class Analytics & Coverage: Theory-Only vs. Unanchored Practical Concepts  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 60-Second Frictionless Judge Walkthrough (Zero Setup Required)

Judges can evaluate the complete multi-course classroom loop directly on **[https://socratix-mentor.vercel.app](https://socratix-mentor.vercel.app)** in under a minute—no account creation or local IDE folder needed:

1. **Open Two Windows Side-by-Side:**
   - **Left Window (`/teacher`):** Open [socratix-mentor.vercel.app/teacher](https://socratix-mentor.vercel.app/teacher). In **Live Lab Sessions**, click **`Populate Demo Class`**.
     - Notice the automatic **`Classroom Bottleneck Alert`** banner flagging **Bob (`PC 02`)** and **Ines (`PC 05`)** stuck on the same milestone.
     - Click any competency badge on Bob's row to inspect `file:location` occurrences, click his progress bar to open the **Milestone Breakdown**, or click **`Code & Chat`** to view his targeted code snapshot.
   - **Right Window (`/student`):** Open [socratix-mentor.vercel.app/student](https://socratix-mentor.vercel.app/student) (defaults to **Bob — `PC 02`** in Jury Sandbox mode).
2. **Test Socratic Guardrails & Cross-Lingual Slide Grounding:**
   - Click **`💡 Hint`** (or **`📖 Concept`**). Observe how `muse-spark-1.3` diagnoses the bug without giving away code.
   - Click the green **Slide Citation Pill** under the reply to open the **Smart Slide Viewer**, and toggle between **`✨ Clean English Slide`**, **`📄 Official PDF`**, and **`🇫🇷 Clean French Slide`**.
3. **Trigger the Live Red-to-Green WebSocket Flip:**
   - In the left panel of `/student`, click the **`JURY`** solution preset button *(visible to Judges/Teachers, automatically hidden from enrolled students)*, then click **`🧪 Check`**.
   - **Watch both screens simultaneously:** `/student` unlocks the **`🏆 Milestone Mastered`** **Competency Report Card**, while Bob's row on `/teacher` flips **instantly** from pulsing red **`BLOCKED`** to emerald **`COMPLETED`** via Supabase Realtime, and his previously failed competencies turn green with a **✨ remediated** marker.
4. **Explore Multi-Course ERP Capabilities (`/teacher`):**
   - Switch the top **`Course:`** selector from **Java OOP** to **Intro to Web Development (HTML_CSS)**, inspect **Class Analytics** and **Curriculum Coverage**, and visit **Course Studio** *(Jury PIN for destructive actions: `2026`)*.

---

## 🔒 Security, Academic Integrity & Privacy

- **Dual-Track Roster & IDOR Isolation:** Unauthenticated visitors operate solely on isolated sandbox personas (`Bob`, `Alice`, `Ines`, `Guest Explorer`). Enrolled students signing in via `/login` (`role === 'student'`) are cryptographically restricted to their own session (`lib/auth-guard.ts`) and never see peer profiles or `JURY` solution presets.
- **Deterministic Anti-Gaming:** Milestone completion in `Check` mode requires server-side verification that all required `target_files` are present and non-trivial, with XML delimiter sanitization preventing prompt-injection overrides inside source code comments.
- **Targeted `JSONB` Code Snapshots:** Only files actively referenced in `inspected_files` are snapshotted per chat turn, preventing database bloat while preserving exact historical context for the instructor.
- **One Codebase, Two Deployment Modes:** `NEXT_PUBLIC_ENABLE_JURY_SANDBOX` switches between frictionless hackathon evaluation (demo personas, `JURY` presets, 1-click access) and strict classroom mode, where all of these are hidden.
- **Guarded Destructive Actions:** course deletion requires a PIN; re-analyzing a single lab shows how many live student sessions will be reset first; the course-wide re-analysis lives in a Danger Zone and requires typing `PURGE`.

---

## 🚀 Local Development Setup

### 1. Clone & Install
```bash
git clone https://github.com/mohamedbelhassen/meta-hackathon-socratix-java-oop-mentor.git
cd meta-hackathon-socratix-java-oop-mentor
pnpm install
```

### 2. Environment Variables (`.env.local`)
Copy `.env.example` to `.env.local`. The essential variables are:
```env
# Supabase (Database, Auth, Storage, Realtime)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Meta Model API (muse-spark-1.3)
META_API_KEY="your-meta-api-key"

# Destructive-action PIN & teacher sign-up code (2026 for the hackathon jury)
JURY_PIN="2026"
NEXT_PUBLIC_JURY_PIN="2026"
TEACHER_SIGNUP_PIN="2026"

# Deployment mode: "true" = hackathon jury sandbox, "false" = strict classroom
NEXT_PUBLIC_ENABLE_JURY_SANDBOX="true"
```
Rate limits, Brevo e-mail notifications and the canonical site URL are documented in `.env.example`.

### 3. Database Migrations & Launch
Apply the SQL migrations in `supabase/migrations/` to your Supabase project (enabling `supabase_realtime` on `student_lab_sessions`), then start the dev server:
```bash
pnpm dev
```
- **Landing Hub:** `http://localhost:3000`
- **Student Workspace:** `http://localhost:3000/student`
- **Teacher ERP Hub:** `http://localhost:3000/teacher`

---

## License

Copyright (C) 2026 Mohamed Belhassen

Socratix is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [GNU Affero General Public License](./LICENSE) for more details.

**Network use (AGPL §13):** if you run a modified version of Socratix as a publicly accessible web service, you must offer its corresponding source code to the users of that service. This repository is the canonical source offer for the reference deployment.
