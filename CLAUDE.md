# Relife Recruit OS — Project Memory

## Project
ATS / Recruitment system for Relife. Located at `D:\ClaudeCode Project\recruit`.
Focus: Recruitment only. NO employee management, payroll, attendance, leave.

## Stack (with breaking changes)
- **Next.js 16** — uses `proxy.ts` NOT `middleware.ts`. Export named `proxy`, not default
- **Prisma 7** — NO `url`/`directUrl` in schema.prisma. URLs go in `prisma.config.ts` datasource. Runtime client uses `PrismaPg` adapter
- **Auth.js v5 (next-auth beta)** — `auth()` for server components, `signIn/signOut` from `next-auth/react` for client
- **shadcn/ui (base-ui/react)** — NO `asChild` prop. Use `render={<Component />}` instead
- **Tailwind v4** — different config from v3
- **@dnd-kit/core** — drag-and-drop for Pipeline Kanban (NOT sortable; column-to-column only)
- TypeScript strict, Zod validation, React Hook Form

## Key Files
- `src/lib/db.ts` — Prisma client with PrismaPg adapter (pooler URL)
- `src/lib/auth.ts` — Auth.js config with Credentials provider
- `src/lib/nav.ts` — Sidebar navigation config (all routes + role restrictions)
- `src/proxy.ts` — Route protection (Next.js 16 proxy)
- `prisma/schema.prisma` — Full DB schema (no url field)
- `prisma.config.ts` — Prisma config with DIRECT_URL for migrations
- `prisma/seed.ts` — Run with `npm run db:seed`
- `src/app/(dashboard)/pipeline/pipeline-config.ts` — STAGE_ORDER + STAGE_CONFIG (Kanban single source of truth)

## Env Variables
```
DATABASE_URL=postgresql://...pooler...:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...pooler...:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xynzirkumyqsxiuyiyut.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
AUTH_SECRET=...
NEXTAUTH_URL=https://recruit-for-hr.vercel.app  ← production (localhost:3000 for local dev)
ANTHROPIC_API_KEY=sk-ant-...   ← required for AI Summary (Phase 6)
```

## Roles
- `SUPER_ADMIN` — full access
- `HR_MANAGER` — no user management
- `HR_STAFF` — no admin/reports

## Candidate Pipeline Stages
NEW_APPLICANT → BOT_SCREENING → WAITING_HR_REVIEW → NEED_MORE_INFO → QUALIFIED → INTERVIEW_SCHEDULED → INTERVIEWED → PASSED / REJECTED / TALENT_POOL / CLOSED

## Folder Structure
```
src/app/(auth)/                         — login page
src/app/(dashboard)/                    — protected pages with sidebar layout
  dashboard/                            — dashboard page
  users/                                — users & roles (SUPER_ADMIN only)
  tags/                                 — tag management (SUPER_ADMIN + HR_MANAGER)
  jobs/                                 — job positions list + create/edit dialog
  jobs/[id]/                            — job detail + candidate list
  candidates/                           — candidate list (filter by status/source, paginated)
  candidates/new/                       — manual add candidate form
  candidates/[id]/                      — candidate profile (info, status, tags, assignment, notes, screening, score, AI summary, interviews, hiring decision)
    candidate-profile-client.tsx        — main interactive client (imports interview-section + hiring-decision-section)
    interview-section.tsx               — schedule interview, list interviews, submit feedback
    hiring-decision-section.tsx         — make/view hiring decision (HR_MANAGER+ only)
  candidates/[id]/edit/                 — edit candidate form
  pipeline/                             — Kanban board (all stages, drag-and-drop, filter by job)
  inbox/                                — chat center (split panel: conversation list + chat view)
  screening/                            — screening form management (list + question CRUD)
  interviews/                           — all interviews list (Upcoming / Past, stats)
  reports/                              — analytics & reports (SUPER_ADMIN + HR_MANAGER only)
  integrations/                         — LINE integration settings (SUPER_ADMIN only)
  bot-config/                           — AI Config: ปรับแต่ง prompt/บุคลิก Daniel HR bot (SUPER_ADMIN + HR_MANAGER)
src/app/api/
  tags/                                 — list all tags (GET), create tag (POST) — HR_MANAGER+ only create
  tags/[id]/                            — update tag (PUT), delete tag (DELETE) — HR_MANAGER+ only
  users/, users/[id]/                   — user CRUD
  jobs/, jobs/[id]/                     — job position CRUD
  candidates/, candidates/[id]/         — candidate CRUD + status history + audit log
  candidates/[id]/notes/                — add note (POST)
  candidates/[id]/notes/[noteId]/       — delete note (DELETE) — creator or SUPER_ADMIN only
  candidates/[id]/tags/[tagId]/         — add tag to candidate (POST), remove tag (DELETE)
  candidates/[id]/assignments/          — assign candidate to HR (POST), unassign (DELETE)
  candidates/[id]/screening/            — get screening Q&A (GET), save answers (POST)
  candidates/[id]/score/                — get score (GET), upsert score (PUT)
  candidates/[id]/ai-summary/           — get AI summary (GET), generate with Claude (POST)
  candidates/[id]/hiring-decision/      — get decision (GET), upsert decision + change status (POST) — HR_MANAGER+ only
  conversations/                        — list conversations (GET) + create (POST)
  conversations/[id]/                   — get detail + messages (GET), update status (PATCH)
  conversations/[id]/messages/          — send HR message (POST)
  conversations/[id]/takeover/          — HR takeover or release bot (POST, action: TAKE_OVER | RELEASE)
  quick-replies/                        — list quick replies (GET)
  openclaw/webhook/                     — mock incoming candidate message + bot auto-reply (POST)
  webhooks/line/                        — real LINE webhook receiver (POST, no auth required)
  integrations/line/                    — manage LINE credentials in DB (GET/PUT/DELETE, SUPER_ADMIN only)
  bot-config/                           — GET all bot config sections, PUT update sections (HR_MANAGER+)
  pipeline/                             — GET all candidates for Kanban board (filter: jobPositionId)
  screening-forms/                      — list all forms (GET), create form (POST) — HR_MANAGER+ only
  screening-forms/[id]/                 — get/update/delete form; DELETE SUPER_ADMIN only
  screening-forms/[id]/questions/       — add question (POST) — HR_MANAGER+ only
  screening-forms/[id]/questions/[qId]/ — update/delete question — HR_MANAGER+ only
  interviews/                           — list all interviews (GET), create interview (POST)
  interviews/[id]/                      — get/update/delete interview (GET/PUT/DELETE)
  interviews/[id]/feedback/             — get feedback (GET), upsert feedback + auto-INTERVIEWED (POST)
src/lib/line.ts                         — LINE API client (verifyLineSignature, replyMessage, pushMessage) — reads from DB
src/lib/kimi.ts                         — Kimi AI client (moonshot-v1-8k)
src/lib/daniel-bot.ts                   — Daniel HR bot — โหลด system prompt จาก DB (bot.* settings) + Kimi fallback
src/components/layout/                  — Sidebar (with dynamic inbox unread badge), Topbar
src/components/ui/                      — shadcn components (incl. textarea.tsx)
src/components/dashboard/              — stat-card.tsx, trend-chart.tsx (recharts "use client")
src/lib/                                — db, auth, utils, nav
src/proxy.ts                            — route protection
prisma/                                 — schema, migrations, seed
```

## Seed Data (after npm run db:seed)
- 4 HR users (admin/manager/staff1/staff2)
- 3 Job Positions: Sales Admin (OPEN), Telesales (OPEN), Content Creator (OPEN)
- 8 Candidates across various pipeline stages
- 10 Tags (มีประสบการณ์, คุณภาพดี, Talent Pool, etc.)
- 9 Quick Replies

## Commands
```bash
npm run dev          # start dev server
npm run build        # build
npm run db:seed      # seed database
npm run db:studio    # prisma studio
npx prisma migrate dev --name <name>   # new migration
npx prisma generate  # regenerate client
```

## Test Accounts (password: password123)
- admin@relife.co.th → SUPER_ADMIN
- manager@relife.co.th → HR_MANAGER
- staff1@relife.co.th → HR_STAFF
- staff2@relife.co.th → HR_STAFF

## Phases
- [x] Phase 1: Auth + Layout + Dashboard + Users & Roles
- [x] Phase 2: Candidate Database + Job Positions
- [x] Phase 3: Chat Center + OpenClaw Mock
- [x] Phase 4: Tags + Notes + Assignment
- [x] Phase 5: Pipeline Kanban Board
- [x] Phase 6: Screening + Score + AI Summary
- [x] Phase 7: Interview Management
- [x] Phase 8: Dashboard + Reports
- [x] Phase 9: Real LINE Integration + Integrations UI
- [x] Phase 10: Security + Audit Log

## UI Conventions
- Colors: blue-600 primary, slate-* neutral, green passed, red rejected, yellow waiting
- Cards: `border-slate-200` border
- All pages: `space-y-6` layout, h1 + subtitle pattern
- Sidebar: fixed left-64, Topbar: fixed top h-16, Content: `ml-64 pt-16 p-6`
- English labels + Thai content/descriptions

## Chat Center Conventions
- Inbox page uses `h-[calc(100vh-4rem-1.5rem)] -m-6` to fill the full viewport (offset layout padding)
- Polling: conversation detail polled every 3s when open; sidebar unread count polled every 10s
- Bot script: 6-step array in `/api/openclaw/webhook/route.ts` — index = candidateMsgCount - 1
- Takeover creates HumanTakeover record + SYSTEM message + sets botEnabled=false on conversation
- Release sets botEnabled=true + creates HumanTakeover record + SYSTEM message
- OpenClaw Mock endpoint (`POST /api/openclaw/webhook`): accepts `{ candidateId, message, channel }` — simulates candidate message + bot reply in one call
- When first candidate message arrives → auto-promote candidate status NEW_APPLICANT → BOT_SCREENING

## Tags Conventions (Phase 4)
- Tags are global (shared across all candidates) — managed at `/tags`
- Only SUPER_ADMIN and HR_MANAGER can create/edit/delete tags; HR_STAFF can assign/remove on candidates
- Tag colors use 6-char hex (`#rrggbb`); 15 preset colors available in UI
- CandidateTag is a junction table — unique constraint `candidateId_tagId`
- Candidate profile shows tags as colored badges with X button (inline remove)
- Add-tag UI: dropdown button showing unassigned tags only

## Assignment Conventions (Phase 4)
- Each candidate has at most 1 active assignment (POST replaces previous assignment)
- User model uses `status: UserStatus` field (not `isActive`) — filter active users with `status: "ACTIVE"`
- Assignment section on profile shows assigned HR with avatar initial + unassign button
- Quick-assign: click any HR user pill to reassign instantly

## Notes Conventions (Phase 4)
- Notes are append-only; edit is not supported (delete + re-add)
- Delete permission: note creator OR SUPER_ADMIN; delete button appears on hover (group-hover)
- Notes ordered newest-first

## Pipeline Kanban Conventions (Phase 5)
- Kanban board at `/pipeline` — uses `@dnd-kit/core` (NOT sortable; drag between columns only)
- `STAGE_ORDER` and `STAGE_CONFIG` in `pipeline-config.ts` — single source of truth for labels/colors
- `GET /api/pipeline?jobPositionId=xxx` — returns flat array of `KanbanCandidate[]`
- Drag-and-drop uses `PointerSensor` with `activationConstraint: { distance: 8 }` (prevents click conflicts)
- Optimistic update on drag end → reverts on API failure
- Status change calls existing `PUT /api/candidates/[id]` with `{ currentStatus }` — already creates StatusHistory + AuditLog
- Board breaks out of `p-6` layout with `-m-6` (same pattern as inbox)
- Column scroll: `overflow-y-auto` per column; board scroll: `overflow-x-auto`
- DragOverlay uses `dropAnimation={null}` for instant snap

## AuditAction Enum (all values)
USER_LOGIN, VIEW_CANDIDATE, EDIT_CANDIDATE, SEND_MESSAGE, TAKEOVER_CONVERSATION,
RESUME_BOT, ASSIGN_HR, CHANGE_CANDIDATE_STATUS, CREATE_INTERVIEW,
SUBMIT_INTERVIEW_FEEDBACK, MAKE_HIRING_DECISION, EXPORT_CANDIDATE,
CREATE_USER, UPDATE_USER, DELETE_USER,
CREATE_TAG, UPDATE_TAG, DELETE_TAG,
ADD_CANDIDATE_TAG, REMOVE_CANDIDATE_TAG,
ASSIGN_CANDIDATE, UNASSIGN_CANDIDATE, DELETE_CANDIDATE_NOTE,
CREATE_SCREENING_FORM, UPDATE_SCREENING_FORM, DELETE_SCREENING_FORM,
SUBMIT_SCREENING_ANSWERS, SCORE_CANDIDATE, GENERATE_AI_SUMMARY

## Screening Conventions (Phase 6)
- ScreeningForm is linked to a JobPosition (one active form per position)
- `GET /api/candidates/[id]/screening` returns `{ form, answers }` — form is the active form for the candidate's position
- Saving answers: DELETE existing + createMany (no unique constraint on screeningAnswer)
- CandidateScore: upsert by `candidateId` (unique); totalScore = sum of 6 dimensions (0–10 each, max 60)
- AI Summary uses `claude-haiku-4-5-20251001`, prompt compiled from candidate info + screening answers + notes + score
- AI response is JSON: `{ summary, strengths (pipe-separated), concerns (pipe-separated), recommendation (RECOMMEND/CONSIDER/NOT_RECOMMEND), nextAction }`
- ANTHROPIC_API_KEY must be set in .env for AI Summary to work
- Screening page at `/screening` — HR_MANAGER+ can create/edit; SUPER_ADMIN only can delete forms; HR_STAFF can view
- Score colors: ≥48 green, ≥30 amber, <30 red (out of 60)

## Interview Management Conventions (Phase 7)
- Interview models: `Interview`, `InterviewFeedback`, `HiringDecision` — all in schema since init
- `POST /api/interviews` — creates interview + auto-changes candidate status to INTERVIEW_SCHEDULED
- `POST /api/interviews/[id]/feedback` — upserts feedback + marks interview COMPLETED + auto-changes candidate to INTERVIEWED
- `POST /api/candidates/[id]/hiring-decision` — upserts decision + changes candidate status (PASSED/REJECTED/TALENT_POOL/CLOSED); HR_MANAGER+ only
- Interview sections are separate components: `interview-section.tsx` and `hiring-decision-section.tsx` (imported by `candidate-profile-client.tsx`)
- InterviewResult options: PASSED | WAITING | REJECTED | NEED_SECOND_INTERVIEW (per-interview result, not final)
- HiringResult options: PASSED | HIRED | REJECTED | TALENT_POOL | CLOSED (final hiring decision)
- `/interviews` page shows all interviews split into Upcoming (SCHEDULED) and Past sections with stats
- Feedback score: 6 dimensions × 0–10 (max 60); same scale as CandidateScore

## LINE Integration Conventions (Phase 9)
- Direct LINE Messaging API integration — ไม่ผ่าน OpenClaw (more stable, 1 hop)
- `POST /api/webhooks/line` — LINE webhook receiver, ไม่ต้อง auth (bypass ใน proxy.ts)
- Signature verification: HMAC-SHA256 of raw body using channelSecret → base64 compare with `X-Line-Signature` header
- LINE credentials เก็บใน `Setting` table (key: `line.channel_secret`, `line.channel_access_token`)
- `src/lib/line.ts` — อ่าน credentials จาก DB ก่อน fallback env var; exports: `verifyLineSignature`, `replyMessage`, `pushMessage`
- `src/lib/kimi.ts` — Kimi AI client (moonshot-v1-8k) สำหรับ Daniel HR bot fallback
- `src/lib/daniel-bot.ts` — Bot logic: โหลด system prompt จาก DB (bot.* settings) + Kimi (moonshot-v1-8k) reply
- Bot reply ใช้ LINE Reply API (replyToken, ฟรี); HR outgoing ใช้ LINE Push API (lineUserId)
- เมื่อ LINE message เข้า → find/create candidate by `lineUserId` → find/create conversation → save message → auto-promote NEW_APPLICANT→BOT_SCREENING → bot reply (ถ้า botEnabled)
- Integrations page ที่ `/integrations` — SUPER_ADMIN only, มี form กรอก/แก้ไข credentials + แสดง Webhook URL + Disconnect
- `GET/PUT/DELETE /api/integrations/line` — manage LINE credentials ใน DB
- HR ส่งข้อความใน Inbox → `POST /api/conversations/[id]/messages` → forward LINE Push API อัตโนมัติ (ถ้า channel=LINE และมี lineUserId)
- Facebook Messenger: planned for Phase 9.2 (not yet implemented)
- Env vars: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `KIMI_API_KEY` (fallback ถ้าไม่มีใน DB)

## Dashboard & Reports Conventions (Phase 8)
- Dashboard at `/dashboard` — server component, fetches all stats including 6-month monthly trend
- `src/components/dashboard/trend-chart.tsx` — "use client" mini BarChart (recharts) for dashboard
- Reports at `/reports` — SUPER_ADMIN + HR_MANAGER only (redirect HR_STAFF to /dashboard)
- `src/app/(dashboard)/reports/page.tsx` — server component, fetches all aggregated data
- `src/app/(dashboard)/reports/reports-client.tsx` — "use client" with all recharts charts
- recharts (`recharts: ^3.8.1`) is installed — use `BarChart`, `PieChart`, `Cell`, `ResponsiveContainer`
- Charts must be in "use client" components; pass serialized data (no Date objects) from server
- Monthly trend aggregated in JS (not raw SQL): build Map of last 6 months, count by createdAt
- Reports sections: Summary Stats → Monthly Trend + Source Donut → Recruitment Funnel (horizontal bar) → Interview Status Donut + Hiring Outcomes Bar → By Position Table
- Reports data type exported from `reports-client.tsx` as `ReportsData`

## AI Config Conventions (Bot Config)
- Bot config sections เก็บใน `Setting` table ด้วย prefix `bot.*` (ไม่ต้องมี migration ใหม่)
- 8 sections: `objectives`, `company_info`, `conversation_flow`, `response_guidelines`, `open_positions`, `critical_rules`, `contact_info`, `custom_instructions`
- Active toggle: `bot.active = "false"` = inactive; ค่าอื่นหรือไม่มี key = active
- `src/lib/daniel-bot.ts` — `getSystemPrompt()` โหลดจาก DB ทุก request; ถ้า inactive return ""; ถ้าไม่มี section ใดเลย fallback to `FALLBACK_PROMPT`
- `GET /api/bot-config` — returns all bot.* settings as `{ key: value }` object (ALLOWED_KEYS only)
- `PUT /api/bot-config` — upserts each key to Setting table with `bot.{key}` prefix; HR_MANAGER+ only
- UI ที่ `/bot-config` — SUPER_ADMIN + HR_MANAGER เข้าถึงได้; HR_STAFF redirect to /dashboard
- Auto-save: 2s debounce หลัง typing; manual save button ก็มี; saving state แสดงใน button
- `bot-config-client.tsx` — accordion per section, character count, filled counter, system prompt preview panel

## Important Rules
1. shadcn uses `@base-ui/react` — use `render` prop not `asChild`. Select `onValueChange` is `(value: string | null) => void`, wrap with `(v) => v && handler(v)`
2. Prisma 7 — no url in schema, use prisma.config.ts
3. Next.js 16 — proxy.ts not middleware.ts
4. Bot state is per-conversation (bot_enabled field)
5. Every message must be saved to DB
6. HR Takeover must block bot from responding
7. All important actions need AuditLog entry
8. Zod `.default()` causes type mismatch with react-hook-form resolver — use plain `.string()` and set default in `defaultValues` instead
9. Status changes must create CandidateStatusHistory + AuditLog entries
10. After adding new AuditAction values to schema.prisma, always run `npx prisma migrate dev` AND `npx prisma generate`
