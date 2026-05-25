# Relife Recruit OS — Project Memory

## Project
ATS / Recruitment system for Relife. Located at `D:\ClaudeCode Project\recruit`.
Focus: Recruitment only. NO employee management, payroll, attendance, leave.
Production: https://recruit-for-hr.vercel.app

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
- `src/lib/experience-tier.ts` — `parseTier(text)` → Tier; Tier = "high"|"mid"|"low"|"unspecified"|"none"
- `src/proxy.ts` — Route protection (Next.js 16 proxy)
- `prisma/schema.prisma` — Full DB schema (no url field)
- `prisma.config.ts` — Prisma config with DIRECT_URL for migrations
- `prisma/seed.ts` — Run with `npm run db:seed`
- `src/app/(dashboard)/pipeline/pipeline-config.ts` — STAGE_ORDER + STAGE_CONFIG (Kanban single source of truth)
- `vercel.json` — Vercel cron config (interview reminder 07:00 Bangkok daily)

## Env Variables
```
DATABASE_URL=postgresql://...pooler...:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...pooler...:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xynzirkumyqsxiuyiyut.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
AUTH_SECRET=...
NEXTAUTH_URL=https://recruit-for-hr.vercel.app  ← production (localhost:3000 for local dev)
ANTHROPIC_API_KEY=sk-ant-...   ← required for AI Summary (Phase 6)
WEBHOOK_FORM_SECRET=...        ← shared secret for /api/webhooks/form
WEBHOOK_QUALIFY_SECRET=...     ← shared secret for /api/webhooks/qualify
NOTION_TOKEN=ntn_...           ← Notion integration token (set in Vercel Production+Preview)
CRON_SECRET=...                ← random string for Vercel cron auth header
LINE_CHANNEL_SECRET=...        ← fallback if not in DB (Production only in Vercel)
LINE_CHANNEL_ACCESS_TOKEN=...  ← fallback if not in DB (Production only in Vercel)
KIMI_API_KEY=...               ← for Daniel bot fallback
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
  dashboard/                            — dashboard (redesigned: hero cards, today's interviews, funnel)
  users/                                — users & roles (SUPER_ADMIN only)
  tags/                                 — tag management (SUPER_ADMIN + HR_MANAGER)
  jobs/                                 — job positions list + create/edit dialog
  jobs/[id]/                            — job detail + candidate list
  candidates/                           — candidate list (filter by status/source, paginated)
  candidates/new/                       — manual add candidate form
  candidates/[id]/                      — candidate profile
    candidate-profile-client.tsx        — main interactive client
    interview-section.tsx               — schedule interview, list interviews, submit feedback
    hiring-decision-section.tsx         — make/view hiring decision (HR_MANAGER+ only)
    qualify-section.tsx                 — pass/fail qualify buttons + LINE push + Notion patch
  candidates/[id]/edit/                 — edit candidate form
  pipeline/                             — Kanban board (all stages, drag-and-drop, filter by job)
  inbox/                                — chat center (split panel: conversation list + chat view)
  review/                               — HR review queue (bulk qualify, auto-qualify, Notion sidebar)
  shortlist/                            — shortlist page ("ส่งข้อความก่อนนัดสัมภาษณ์")
  calendar/                             — interview calendar (month grid + daily detail)
  screening/                            — screening form management (list + question CRUD)
  interviews/                           — all interviews list (Upcoming / Past, stats)
  reports/                              — analytics & reports (SUPER_ADMIN + HR_MANAGER only)
  integrations/                         — LINE integration settings (SUPER_ADMIN only)
  ~~bot-config/~~                       — DELETED → redirect to /settings/ai via proxy.ts
src/app/api/
  tags/, tags/[id]/                     — tag CRUD
  users/, users/[id]/                   — user CRUD
  jobs/, jobs/[id]/                     — job position CRUD
  candidates/, candidates/[id]/         — candidate CRUD + status history + audit log
  candidates/[id]/notes/                — add/delete note
  candidates/[id]/tags/[tagId]/         — add/remove tag
  candidates/[id]/assignments/          — assign/unassign HR
  candidates/[id]/screening/            — get/save screening Q&A
  candidates/[id]/score/                — get/upsert score
  candidates/[id]/ai-summary/           — get/generate AI summary
  candidates/[id]/hiring-decision/      — get/upsert hiring decision
  candidates/[id]/qualify/              — POST: pass/fail → status change + LINE push + Notion patch
  candidates/[id]/notion-detail/        — GET: fetch Notion page properties + deep Q&A blocks; 404=no page, 502=Notion API error
  candidates/bulk-qualify/              — POST { ids[], result:"pass"|"fail" } bulk qualify
  candidates/auto-qualify/              — POST { dryRun:bool } — dry run returns preview; false executes
  conversations/                        — list/create conversations
  conversations/[id]/                   — get detail+messages / update status
  conversations/[id]/messages/          — send HR message → LINE push auto
  conversations/[id]/takeover/          — HR takeover / release bot
  quick-replies/                        — list quick replies
  calendar/interviews/                  — GET ?month=YYYY-MM → interviews grouped by Bangkok date
  inbox/init/                           — GET: returns quickReplies + tags + hrUsers (batch lazy load)
  candidates/auto-tag-positions/        — POST: backfill position tags for all candidates (⚠️ no auth)
  cron/interview-reminders/             — GET (Vercel cron, CRON_SECRET auth) — daily LINE reminder at 07:00 BKK
  openclaw/webhook/                     — mock incoming message + bot reply
  openclaw/sync/                        — LINE→Recruit sync: candidate msg + LINE profile
  openclaw/check-paused/               — GET?lineUserId → HR takeover check (no auth, no-store)
  openclaw/backfill-profiles/          — backfill LINE profiles
  openclaw/config/                      — public, compiles openclaw.rules.* → system prompt
  openclaw/workspace/                   — GET/POST/PUT workspace files (bidirectional sync)
  webhooks/line/                        — real LINE webhook receiver (no auth)
  webhooks/form/                        — Google Form → Recruit OS (x-webhook-secret)
  webhooks/qualify/                     — Make.com qualify → status + LINE + inbox
  integrations/line/                    — manage LINE credentials in DB
  settings/ai/openclaw/                — OpenClaw AI config (openclaw.* in Setting)
  settings/ai/openclaw-rules/          — Bot Rules หลิน (openclaw.rules.* in Setting)
  settings/auto-qualify/               — GET/PUT autoqual rules (expPassTiers, salaryMax, salesMin)
  settings/qualify-messages/           — GET/PUT qualify message templates (qualify.msg_pass/fail)
  pipeline/                             — GET all candidates for Kanban
  screening-forms/, screening-forms/[id]/ — screening form CRUD
  interviews/, interviews/[id]/         — interview CRUD
  interviews/[id]/feedback/             — upsert feedback + auto-INTERVIEWED
  admin/backfill-experience/            — backfill experience tier from Notion
  admin/notion-test/                    — ⚠️ TEMP debug endpoint — delete after confirming NOTION_TOKEN

src/lib/
  db.ts, auth.ts, utils.ts, nav.ts
  line.ts           — LINE API (verifyLineSignature, replyMessage, pushMessage) — reads from DB
  kimi.ts           — Kimi AI client (moonshot-v1-8k)
  daniel-bot.ts     — Daniel HR bot (DB system prompt + Kimi fallback)
  openclaw-client.ts — OpenClaw API client
  experience-tier.ts — parseTier() + Tier type + TIER_CONFIG (colors/labels/order)

src/components/
  layout/           — Sidebar (unread badge), Topbar
  ui/               — shadcn components
  dashboard/        — stat-card.tsx, trend-chart.tsx (recharts "use client")
  ai-config/        — AI settings tab components

prisma/             — schema, migrations, seed
```

## Setting Table Keys (key-value config store)
```
line.channel_secret          — LINE credentials
line.channel_access_token
bot.*                        — Daniel bot system prompt sections
openclaw.*                   — OpenClaw AI config
openclaw.rules.*             — Bot Rules หลิน
openclaw.file.*              — Workspace files (SOUL.md, POSITIONS.md, RULES.md, EXAMPLES.md)
qualify.msg_pass             — LINE message template for passing candidates
qualify.msg_fail             — LINE message template for failing candidates
autoqual.exp_pass_tiers      — comma-separated tiers that auto-qualify (e.g. "high,mid")
autoqual.salary_max          — max acceptable expected salary (int, null = skip rule)
autoqual.sales_min           — min max-sales amount required (int, null = skip rule)
```

## Experience Tier System (`src/lib/experience-tier.ts`)
```typescript
type Tier = "high" | "mid" | "low" | "unspecified" | "none"
// high  = 5+ years (green)
// mid   = 2-4 years (blue)
// low   = <2 years (amber)
// unspecified = has experience keywords but no years mentioned (violet)
// none  = no experience / fresh grad (slate)
```
- `parseTier(text)` — strips age context patterns (อายุ X ปี) before numeric parsing
- "unspecified": text has keywords (เคย/ขาย/ทำงาน/งาน/ประสบการณ์) but no year number
- Used in: review page tier badge, auto-qualify rule evaluation

## Auto-Qualify System
- **Settings** stored in Setting table: `autoqual.exp_pass_tiers` (comma-sep), `autoqual.salary_max`, `autoqual.sales_min`
- **Rules**: tier not in passlist → reject; salary > max (if data exists) → reject; maxSales < min (if data exists) → reject
- **No data = skip rule** (null expectedSalary or maxSalesAmount → don't reject on that rule)
- **Verdict**: reject → REJECTED; all rules pass + tier in list → QUALIFIED; else → hrReview (stay in queue)
- **Queue statuses scanned**: WAITING_HR_REVIEW, BOT_SCREENING, NEW_APPLICANT, NEED_MORE_INFO
- **dryRun=true**: returns `{ autoQualify[], autoReject[], hrReview[] }` — preview only, no DB changes
- **dryRun=false**: processes all, sends LINE, patches Notion, returns `{ qualifyDone, rejectDone, hrReview }`
- **Safety**: returns 400 if no rules set at all
- **UI**: ⚡ Auto-Qualify button in review page → opens preview modal → confirm to execute

## Qualify Messages
- Stored in Setting: `qualify.msg_pass`, `qualify.msg_fail`
- `DEFAULT_MSG_PASS` / `DEFAULT_MSG_FAIL` exported from `/api/settings/qualify-messages/route.ts`
- All qualify routes import these as fallback: qualify/route.ts, bulk-qualify/route.ts, auto-qualify/route.ts
- Editable via MessageTemplateDialog in review page (🗨️ button)

## Calendar Page (`/calendar`)
- Server component fetches current month SCHEDULED interviews → passes to CalendarClient
- Month grid: green highlight = today, violet badge = days with interviews
- Click day → update daily detail panel (right side)
- Interview cards: time range (startTime–endTime), avatar, type badge (ONLINE/ONSITE/PHONE), meeting link or location, candidateResponse badge
- **Quick Actions** on each card (action bar at bottom):
  - 👤 โปรไฟล์ → `/candidates/[id]`
  - 💬 แชท → `/inbox/[conversationId]` (only if candidate has conversation)
  - 📋 Copy Link (ONLINE only) → copies meetingLink to clipboard with 2s feedback
  - ▶️ เปิด Meet (ONLINE only) → opens meetingLink in new tab
  - 🗑️ ลบนัด → DELETE `/api/interviews/[id]` (confirm dialog first)
- Deletions update state instantly (`days` held in `useState`, `onDeleted` callback from InterviewCard)
- DB query also selects `endTime` + `candidate.conversations` (latest 1)
- `GET /api/calendar/interviews?month=YYYY-MM` — Bangkok UTC+7 date grouping
- Month navigation handled client-side (useRouter + searchParams)
- InterviewType union: `"ONLINE" | "ONSITE" | "PHONE"`

## Interview Reminder Cron
- **Schedule**: `0 0 * * *` UTC = 07:00 Bangkok (defined in `vercel.json`)
- **Endpoint**: `GET /api/cron/interview-reminders`
- **Auth**: `Authorization: Bearer ${CRON_SECRET}` header (CRON_SECRET env var in Vercel)
- **Logic**: finds today's SCHEDULED interviews (Bangkok date range) where `reminderSentAt = null` AND `candidateResponse != "declined"` → sends LINE push → marks `reminderSentAt = now()`
- **Bangkok range**: `startOfDay` = `new Date(Date.UTC(y, m, d, -7, 0, 0))` (UTC-7h offset)
- **Schema**: `Interview.reminderSentAt DateTime? @map("reminder_sent_at")`

## Notion Integration
- **Token**: `NOTION_TOKEN=ntn_...` in Vercel (Production + Preview) and local `.env`
- **Bot user**: "google form intregation" (workspace: RELIFE SOLUTIONS)
- **API route**: `GET /api/candidates/[id]/notion-detail`
  - Returns 404 `{ error: "no_notion_page" }` if candidate has no notionPageId
  - Returns 502 `{ error: "Notion XXX" }` if Notion API call fails (with actual HTTP status in message)
  - Returns 200 `{ info, qa }` on success
- **Properties extracted**: ชื่อ-นามสกุล/ชื่อเล่น, เบอร์โทร, อีเมล, อายุ, บุตร, ที่อยู่, ตำแหน่ง, ประสบการณ์, ยอดขายสูงสุด, รายได้ที่คาดหวัง, อุปกรณ์, ID Line
- **Deep Q&A**: parsed from page blocks — h1 "📝 คำถามเชิงลึก" marks start; h2=question, paragraph=answer
- **Called from**: review-client.tsx sidebar sheet (opens on candidate click)
- **Notion patch** (qualify): updates `Qualify` select + `ส่งแจ้งผลแล้ว` checkbox via PATCH /pages/:id
- **notionPageId format**: stored with or without hyphens — both work with Notion API
- **⚠️ Pending**: `GET /api/admin/notion-test` debug endpoint should be deleted after confirming NOTION_TOKEN is correct in production

## Dashboard (Redesigned)
- 3 hero stat cards: total applicants (blue), qualified today (amber), interviews today (green)
- Grid 2/3 + 1/3: trend chart + funnel chart (left) | channel breakdown (right)
- Today's interviews mini-list + recent candidates row at bottom
- All data fetched server-side in `dashboard/page.tsx`

## Review Page (`/review`) Conventions
- Lists candidates in QUEUE_STATUSES (same as auto-qualify)
- Checkboxes per row + select-all → floating bulk action bar appears
- Bulk action bar: ✅ ผ่าน / ❌ ไม่ผ่าน → calls `/api/candidates/bulk-qualify`
- 🗨️ button → MessageTemplateDialog (edit qualify message templates)
- 🎛️ button → AutoQualifySettingsDialog (tier checkboxes + salary + maxSales inputs)
- ⚡ Auto-Qualify button → POST dryRun=true → AutoQualifyPreviewModal → confirm → POST dryRun=false
- Click candidate row → Sheet sidebar opens → fetches `/api/candidates/[id]/notion-detail`
- Sidebar shows: Notion info (name, phone, email, salary, experience, equipment) + deep Q&A
- Experience tier badge shown with TIER_CONFIG color

## Shortlist Page
- Status label changed: "ส่งข้อความก่อนนัดสัมภาษณ์" (was "รอคอนเฟิร์มเริ่มงาน")
- This stage = online interview invitation, not job confirmation

## Schema Changes
```prisma
model Interview {
  reminderSentAt  DateTime? @map("reminder_sent_at")  // ← added Phase 13
}
model Candidate {
  maxSalesAmount       Int?      @map("max_sales_amount")         // ← added Phase 13
  // Phase 14 (planned — self-scheduling):
  scheduleToken        String?   @unique @map("schedule_token")
  scheduleTokenExpiresAt DateTime? @map("schedule_token_expires_at")
}
// Phase 14 (planned — self-scheduling):
model InterviewSlot {
  id          String   @id @default(cuid())
  date        DateTime
  startTime   DateTime
  endTime     DateTime
  label       String?
  isAvailable Boolean  @default(true) @map("is_available")
  createdAt   DateTime @default(now()) @map("created_at")
  @@map("interview_slots")
}
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
- [x] Phase 11: AI Config + AI Playground Module *(deployed 2026-05-03, commit b83bc3a)*
- [x] Phase 12: OpenClaw ↔ Website Integration *(2026-05-04)*
- [x] Phase 12.1: LINE bot fixes + UI cleanup *(2026-05-06, commit c3f0aba)*
- [x] Phase 12.2: Bot Rules (หลิน) UI tab *(2026-05-06, commit 794ac43)*
- [x] Phase 12.3: Workspace File Bidirectional Sync *(2026-05-07, commit 9ff4b17)*
- [x] Phase 13: HR Productivity Features *(2026-05-10)*
  - Experience tier system (high/mid/low/unspecified/none) + age context stripping
  - Review page: bulk qualify, auto-qualify (rules + dry-run preview), message templates
  - Calendar page (/calendar): month grid + daily interview detail
  - Interview reminder cron (Vercel, 07:00 Bangkok daily)
  - Dashboard redesign: hero cards, today's interviews, funnel
  - Notion sidebar in review page: fetch page properties + deep Q&A
  - Auto-qualify rules: expPassTiers + salaryMax + salesMin stored in Setting table
  - Shortlist label: "ส่งข้อความก่อนนัดสัมภาษณ์"
- [x] Phase 14: Performance + UX Improvements *(2026-05-19)*
  - **nextjs-toploader**: blue progress bar on all page transitions (`src/app/layout.tsx`)
  - **Inbox lazy loading**: server page only fetches conversations (take: 100); secondary data (quickReplies, tags, hrUsers) fetched client-side via `/api/inbox/init`; candidatesWithoutConversation lazy-fetched only when "+ New Conversation" clicked
  - **Candidates search debounce**: 350ms debounce using `useRef<ReturnType<typeof setTimeout>>` in candidates-client.tsx
  - **Loading skeletons** (`loading.tsx`): candidates/[id], jobs, interviews, reports, screening, settings/ai
  - **Delete interview button**: trash icon in interview-section.tsx (SCHEDULED interviews only); `DELETE /api/interviews/[id]`; confirm dialog; updates list instantly + router.refresh()
  - **Calendar quick actions**: action bar on each InterviewCard (Profile, Chat, Copy Link, Open Meet, Delete); deletions update CalendarClient state instantly (days as useState, onDeleted callback)
- [x] Phase 14.1: Mobile Responsive + Jobs→Bot Sync *(2026-05-25)*
  - **Mobile layout**: `DashboardShell` client component holds `sidebarOpen` state; Sidebar slides in as drawer + overlay; Topbar hamburger button; auto-close on route change
  - **Inbox mobile**: list-or-chat toggle (not side-by-side); back button (ArrowLeft) in chat header; QuickActionsPanel hidden below `lg` breakpoint; `-m-4 md:-m-6`
  - **Content padding**: `p-4 md:p-6` (was always `p-6`)
  - **⚠️ Case sensitivity**: Vercel/Linux is case-sensitive — git tracks `sidebar.tsx`/`topbar.tsx` (lowercase); always import with matching case
  - **syncPositionsMd()**: `src/lib/sync-positions.ts` — auto-updates `openclaw.file.POSITIONS.md` in Setting table + sets dirty flag whenever job is created/updated/deleted; uses `<!-- AUTO_POSITIONS_START/END -->` markers to preserve manual content (form links etc.)
  - **Jobs → Bot sync**: POST/PUT/DELETE `/api/jobs` and `/api/jobs/[id]` all call `syncPositionsMd()` after DB change

## UI Conventions
- Colors: blue-600 primary, slate-* neutral, green passed, red rejected, yellow waiting
- Cards: `border-slate-200` border
- All pages: `space-y-6` layout, h1 + subtitle pattern
- Sidebar: fixed left-64 desktop / slide-in drawer mobile; Topbar: fixed top h-16, `left-0 md:left-64`; Content: `md:ml-64 pt-16 p-4 md:p-6`
- **DashboardShell** (`src/components/layout/dashboard-shell.tsx`): client component wrapping Sidebar + Topbar + main; holds `sidebarOpen` state
- English labels + Thai content/descriptions

## Chat Center Conventions
- Inbox page uses `h-[calc(100vh-4rem-1.5rem)] -m-4 md:-m-6` to fill full viewport
- Polling: conversation detail **3s**; unread count 10s; conversation list **5s**
- Conversation list sorted by `lastMessageAt desc`
- Takeover: HumanTakeover record + SYSTEM message + botEnabled=false
- HR takeover check: **HumanTakeover records** (not botEnabled field)
- LINE profile (displayName + pictureUrl) saved to candidate on every sync
- **Lazy loading** (Phase 14): InboxClient starts with empty quickReplies/tags/hrUsers → fetches `/api/inbox/init` on mount; candidatesWithoutConversation fetched only when "+ New Conversation" clicked (`?noConversation=true`)
- Inbox server page only queries conversations (take: 100) — secondary data deferred to client

## Tags Conventions (Phase 4)
- Tags are global — managed at `/tags`; HR_MANAGER+ create/edit/delete
- Tag colors: 6-char hex (`#rrggbb`); 15 presets
- CandidateTag junction table — unique constraint `candidateId_tagId`

## Assignment Conventions (Phase 4)
- Each candidate max 1 active assignment (POST replaces)
- User model uses `status: UserStatus` — filter active: `status: "ACTIVE"`

## Notes Conventions (Phase 4)
- Append-only; delete permission: creator OR SUPER_ADMIN
- Ordered newest-first

## Pipeline Kanban Conventions (Phase 5)
- `@dnd-kit/core` — NOT sortable; column-to-column drag only
- `STAGE_ORDER` + `STAGE_CONFIG` in `pipeline-config.ts`
- `GET /api/pipeline?jobPositionId=xxx` → flat array `KanbanCandidate[]`
- PointerSensor `activationConstraint: { distance: 8 }` (prevents click conflicts)
- DragOverlay `dropAnimation={null}` for instant snap

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
- ScreeningForm linked to JobPosition (one active form per position)
- Saving answers: DELETE existing + createMany
- CandidateScore: upsert by `candidateId`; totalScore = sum of 6 dimensions (0–10, max 60)
- AI Summary: `claude-haiku-4-5-20251001`; response JSON: `{ summary, strengths, concerns, recommendation, nextAction }`
- Score colors: ≥48 green, ≥30 amber, <30 red

## Interview Management Conventions (Phase 7)
- `POST /api/interviews` → creates + auto-status INTERVIEW_SCHEDULED
- `POST /api/interviews/[id]/feedback` → upserts + COMPLETED + auto-status INTERVIEWED
- `POST /api/candidates/[id]/hiring-decision` → PASSED/REJECTED/TALENT_POOL/CLOSED (HR_MANAGER+)
- InterviewResult: PASSED | WAITING | REJECTED | NEED_SECOND_INTERVIEW (per-interview)
- HiringResult: PASSED | HIRED | REJECTED | TALENT_POOL | CLOSED (final)
- Feedback score: 6 dimensions × 0–10 (max 60)

## LINE Integration Conventions (Phase 9)
- Direct LINE Messaging API — ไม่ผ่าน OpenClaw
- LINE credentials in Setting table (`line.channel_secret`, `line.channel_access_token`)
- `src/lib/line.ts` — reads from DB then fallback env var
- Bot reply: LINE Reply API (replyToken); HR outgoing: LINE Push API (lineUserId)
- Facebook Messenger: planned (not implemented)

## Dashboard & Reports Conventions (Phase 8)
- recharts (`recharts: ^3.8.1`) — charts must be in "use client" components
- Monthly trend: aggregated in JS (not SQL), last 6 months Map
- Reports: Summary → Monthly Trend + Source Donut → Funnel → Interview Status + Hiring Outcomes → By Position Table

## AI Config Conventions
- Bot config: `bot.*` keys in Setting table
- OpenClaw config: `openclaw.*` keys
- Bot Rules หลิน: `openclaw.rules.*` keys
- Workspace files: `openclaw.file.*` keys
- `GET /api/openclaw/config` — public, CORS *, no-store; returns `{ active, prompt, sections }`

## OpenClaw Integration Conventions (Phase 12 + 12.1)
- `POST /api/openclaw/sync` — saves candidate msg + LINE profile; skips botReply if `"__profile_backfill__"`
- `GET /api/openclaw/check-paused?lineUserId=xxx` — checks HumanTakeover records; no auth, no-store
- `AIConversation` model — 1-to-1 with Conversation; stores `openclawId`
- `SourceChannel` enum includes `WEBSITE` (purple badge)
- `/daniel` page — real-time stats, live conversations, connection config

## OpenClaw Middleware (WSL) — หลิน Bot
> ⚠️ **หลินรันอยู่บน WSL (เครื่อง local) ไม่ใช่ VPS**
> VPS `194.233.91.166` = Hermes AI agent (คนละระบบ)
> การแก้ไขบทสนทนา/rules/soul ของหลิน → แก้ที่ WSL บนเครื่อง local เท่านั้น

**Path**: `\\wsl.localhost\Ubuntu-24.04\home\graph\.openclaw\workspace-hr\scripts\`

- **middleware.py** (port 18788) — receives LINE webhooks, 3s debounce, forwards to OpenClaw (18789)
  - image/file → forward to OpenClaw for OCR
  - sticker/video/audio/location → ack + drop (MEDIA_ACK_MAP)
  - `is_bot_paused(userId)` check (cached 30s) → skip OpenClaw if HR took over
  - Fetches LINE profile → sends in sync payload
- **outbound_dedup.py** (port 19000) — outbound proxy; dedup + garbage detection
- **session_manager.py** — per-user session state (SQLite)
- **start-tunnel.sh** — starts middleware + outbound_dedup + ngrok tunnel (primary) → cloudflared fallback; auto-updates LINE webhook URL
- **Workspace files**: SOUL.md, POSITIONS.md, RULES.md, EXAMPLES.md

**SOUL.md key rules**:
- กฎ 4: OCR รูปก่อนตอบ
- กฎ 5: Sales Admin เวลางาน 06:00-22:00 ทุกวัน
- กฎ 6: ที่อยู่บริษัท locked = **76/4 อาคารแพลตินัมเพลส ซอยรามคำแหง 178 เขตมีนบุรี กทม. 10510**
- กฎ 7: WFH เฉพาะ Sales Admin

**ngrok** (PRIMARY tunnel): installed at `/usr/local/bin/ngrok` (v3.39.1)
- authtoken saved to `/home/graph/.config/ngrok/ngrok.yml`
- **Static domain**: `doorway-armless-roamer.ngrok-free.dev` (ไม่เปลี่ยนตลอดไป)
- **LINE webhook**: ตั้งไว้ที่ `https://doorway-armless-roamer.ngrok-free.dev/line/webhook` (permanent — ไม่ต้อง set ใหม่)
- รัน: `ngrok http 18788 --log=stdout` (ไม่ต้องใส่ `--domain` flag — ดึง static domain จาก account อัตโนมัติ)
- ถ้า ngrok ล่ม → cloudflared รับต่อ แต่ LINE webhook URL จะเปลี่ยน ต้อง update manual

**cloudflared** (FALLBACK): installed at `/home/linuxbrew/.linuxbrew/bin/cloudflared` (v2026.3.0 via Homebrew)
- `sudo cloudflared` จะ error เพราะ sudo ไม่เห็น Homebrew PATH — ปกติ
- start-tunnel.sh ใช้ `CLOUDFLARED_BIN="${CLOUDFLARED:-/home/linuxbrew/.linuxbrew/bin/cloudflared}"` — ถูกต้อง
- **Cloudflare Quick Tunnel status**: ถ้า error 1101 = Cloudflare ล่มฝั่งเขา รอแล้วรันใหม่

**LINE Webhook API** (important):
- Field name สำหรับ PUT `/v2/bot/channel/webhook/endpoint` คือ **`endpoint`** (ไม่ใช่ `webhookEndpointUrl` — LINE เปลี่ยน API แล้ว)
- ตัวอย่าง: `{"endpoint": "https://..."}`

**To restart middleware + tunnel**:
```bash
wsl -d Ubuntu-24.04 -u graph -- sh -c 'cd /home/graph/.openclaw/workspace-hr/scripts && bash start-tunnel.sh'
```

**Tunnel troubleshooting**:
- localtunnel ไม่ทำงานใน WSL นี้ (503 เสมอ ปัญหา WSL network)
- serveo.net ไม่ stable (process ตายเร็ว)
- start-tunnel.sh: ngrok primary → cloudflared fallback
- ถ้า Cloudflare ล่ม: ngrok รับต่อได้เลย URL ไม่เปลี่ยน

## VPS — Hermes AI Agent (คนละระบบจากหลิน)
> ⚠️ **อย่าสับสนกับ WSL** — VPS = Hermes, WSL local = หลิน (OpenClaw)

- **IP**: `194.233.91.166` (root)
- **SSH config**: `~/.ssh/config` → `Host hermes-vps` ใช้ key `~/.ssh/id_ed25519_hermes`
- **เข้าถึง**: VS Code → `Ctrl+Shift+P` → Remote-SSH: Connect to Host → `hermes-vps`
- **Hermes path**: `/root/.hermes/` — agents, memories, skills, plugins, sessions
- **Hermes binary**: `/usr/local/bin/hermes` (จริงๆ รันผ่าน Python venv `/usr/local/lib/hermes-agent/venv/`)
- **Web UI**: `http://127.0.0.1:9119` (ดูผ่าน SSH tunnel: `ssh -L 9119:localhost:9119 hermes-vps`)
- **systemd service**: `hermes.service` — enabled + running 24/7 (auto-start on boot)
  ```bash
  systemctl status hermes
  systemctl restart hermes
  tail -f /var/log/hermes.log
  ```
- **channel_directory.json**: `/root/.hermes/channel_directory.json` — Telegram DM ID `8298363344`
- **Obsidian sync**: ยังไม่ได้ implement — แผนใช้ Syncthing + Obsidian Local REST API

## Important Rules
1. shadcn uses `@base-ui/react` — `render` prop not `asChild`; Select `onValueChange: (v: string | null) => void`
2. Prisma 7 — no url in schema, use prisma.config.ts
3. Next.js 16 — proxy.ts not middleware.ts
4. Bot state is per-conversation (bot_enabled field)
5. Every message must be saved to DB
6. HR Takeover must block bot from responding
7. All important actions need AuditLog entry
8. Zod `.default()` causes type mismatch with react-hook-form resolver — use plain `.string()` and set default in `defaultValues`
9. Status changes must create CandidateStatusHistory + AuditLog entries
10. After adding new AuditAction values: run `npx prisma migrate dev` AND `npx prisma generate`
11. Bangkok timezone: UTC+7; date range = `new Date(Date.UTC(y, m, d, -7, 0, 0))` for startOfDay BKK
12. Notion API accepts both hyphenated and non-hyphenated page IDs
13. Auto-qualify: null salary/sales = skip rule (don't reject just because data is missing)

## Candidate Self-Scheduling (Phase 15 — Planned)
**Flow**: ผู้สมัครตอบ "ไม่สะดวก" → bot auto-sends booking link → ผู้สมัครเปิด link เลือก slot เอง → ระบบสร้างนัดอัตโนมัติ

**Files to create/modify**:
- `prisma/schema.prisma` — add `InterviewSlot` model + `scheduleToken`/`scheduleTokenExpiresAt` on Candidate
- `prisma/migrations/` — `npx prisma migrate dev --name add_interview_slots_and_schedule_token`
- `src/app/api/interview-slots/route.ts` — GET (list) + POST (create)
- `src/app/api/interview-slots/[id]/route.ts` — DELETE
- `src/app/api/schedule/[token]/route.ts` — GET (validate token + list slots) + POST (book slot → creates Interview)
- `src/app/schedule/[token]/page.tsx` — **public page** (outside `(dashboard)` group) — shows available slots, candidate books one
- `src/proxy.ts` — add `/schedule` and `/api/schedule` as public routes (bypass auth)
- `src/app/api/openclaw/sync/route.ts` — in `handleInterviewResponse()`: detect "ไม่สะดวก" → generate token → send LINE booking link
- Calendar page — add slot management UI (HR ตั้ง slot ล่วงหน้า)

**Token generation**: `crypto.randomBytes(24).toString("hex")`, 7-day expiry
**Booking link format**: `https://recruit-for-hr.vercel.app/schedule/[token]`

**When candidate books**: POST `/api/schedule/[token]` with `slotId` → creates Interview record + marks slot unavailable + marks token used + sends LINE confirmation

## Known Issues / TODO
- [x] ~~**DELETE** `/api/admin/notion-test`~~ — ลบแล้ว (2026-05-10); NOTION_TOKEN อัปเดตใน Vercel แล้ว ทำงานปกติ
- [x] ~~**Notion 502 in production**~~ — แก้แล้ว: อัปเดต NOTION_TOKEN ใน Vercel (2026-05-10)
- [x] ~~**LINE bot offline**~~ — แก้แล้ว: ngrok เป็น primary tunnel (static domain ถาวร)
- [x] ~~**Candidate self-scheduling**~~ — plan completed (see Phase 15 section above), not yet implemented
- [ ] **Implement Phase 15**: Candidate self-scheduling (schema + APIs + public page + bot trigger)
- [ ] **Fix `/api/admin/backfill-address`** — missing `x-admin-secret` header check
- [ ] **Delete interview audit log** — `DELETE /api/interviews/[id]` should create AuditLog entry
- [ ] **Fix `/api/candidates/auto-tag-positions`** — no auth, anyone can call this endpoint
- [ ] **Auto-tag dangling tagId** — if Tag deleted, AiTaggingRule.tagId becomes stale → tag silently not applied; add validation in settings UI
- [ ] **Mobile polish** — pages load OK on mobile but layout still messy; needs per-page responsive pass (tables, grids, filter bars, stat cards)
- [ ] **Implement Phase 15**: Candidate self-scheduling
