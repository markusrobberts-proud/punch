# Proud Email OS

Internal email-marketing platform for Proud Creative. Plans monthly calendars, drafts copy and design briefs, and structures client approvals, powered by Claude with each brand's knowledge bank as context.

Spec docs live in the parent folder (`../Proud Creative - Email Studio.md`, `../proud-email-os-phase-2-spec.md`). Production plan: `~/.claude/plans/i-am-creating-an-recursive-pixel.md`.

## Stack

- **Next.js 16** (App Router, RSC, Server Actions) + Turbopack
- **Tailwind CSS 4** + shadcn/ui, Apple-OS / liquid-glass aesthetic
- **Supabase** Postgres + Auth (magic link) + Storage + Realtime
- **Vercel AI Gateway** → Anthropic (Sonnet / Opus / Haiku)
- **Resend** (inbound + outbound email), Phase 2B
- **Vercel** hosting + Cron

## Integration accounts (confirmed)

> Every third-party connection must be re-confirmed before any push or wire-up. See the plan's "Integration account linking" hard-gate section.

| Service | Account |
|---|---|
| GitHub | `markusrobberts-proud/proud-email-os` |
| Vercel | team `markusrobberts-prouds-projects` |
| Supabase | project `iefqhohbyfjpeelrjfmc` |

## Local development

```bash
cp .env.example .env.local   # fill in keys
pnpm install
pnpm dev                     # http://localhost:3000
```

Supabase keys live in Project Settings → API for project `iefqhohbyfjpeelrjfmc`.

## Database

Migrations in `supabase/migrations/`. Apply via Supabase SQL editor or:

```bash
supabase link --project-ref iefqhohbyfjpeelrjfmc
supabase db push
```

Initial migration (`0001_init.sql`) sets up:

- Users / brands / brand_members with RLS
- Knowledge bank + Proud Strategy
- Campaign plans / series / emails (text + designed + SMS)
- Klaviyo cache + recommendations + EOM reports
- Approval links + actions (Phase 2B)
- Audit log

## Auth & roles

Supabase magic link sign-in. Roles enforced from day one:

- **admin**: full access
- **strategist**: read/write everything except user mgmt, edits Proud Strategy
- **designer**: briefs + calendar for assigned brands
- **viewer**: read-only on assigned brands
- **pending**: new signup awaiting admin approval (lands on `/awaiting-approval`)

## Folder layout

```
app/(auth)/{login, callback, awaiting-approval}
app/(dashboard)/{page, calendar, knowledge, strategy, klaviyo, eom, settings}
components/{ui, layout}
lib/{auth, rbac, utils, supabase, ai, knowledge}
supabase/migrations
```

## Status

Phase 2A Week 1 scaffold complete. Local only, no remote pushes yet.
