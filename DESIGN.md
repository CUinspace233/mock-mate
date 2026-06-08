# MockMate Design System

## Overview

MockMate should feel like a modern Silicon Valley AI product: calm, intelligent,
trustworthy, and conversation-first. The target experience is a **ChatGPT-like AI
interview copilot workspace** for practicing interviews, drilling into resume
projects, reviewing feedback, and tracking improvement.

This does not mean copying ChatGPT, OpenAI, or any other third-party brand. The
goal is to borrow the product qualities users associate with mature AI tools:
minimal chrome, a strong central conversation canvas, a persistent left sidebar,
bottom composer ergonomics, restrained color, high readability, and clear state.

The current frontend stack remains the implementation foundation:

- React 19
- Vite
- TypeScript
- MUI Joy UI
- Inter
- Existing routes: `/chat`, `/resume-drill`, `/history`, `/progress`
- Existing frontend API layer, Zustand store, and backend wire shapes

Do not redesign the backend contract as part of this visual system. This document
defines the frontend target state before the page refactor begins.

**Key characteristics:**
- ChatGPT-like shell: left sidebar, central workspace, bottom composer.
- Near-white canvas, white panels, thin neutral borders, very subtle shadows.
- MockMate blue is retained, but used sparingly for primary actions and active
  state.
- Conversation content is the visual center of gravity.
- Practice configuration is available but secondary, expressed as summary chips
  plus an expandable setup panel.
- Auth, chat, resume drill, history, and progress share one restrained product
  language.

## Product Positioning

### AI Interview Copilot

MockMate is not a generic dashboard. It is an AI copilot for interview practice.
The most important surface is the conversation: question, candidate answer,
follow-up, evaluation, and next action.

### Silicon Valley Product Feel

The interface should feel like a polished early-stage AI product from a strong
Bay Area team:

- Fast to understand.
- Quiet and confident.
- Sparse but not empty.
- Premium through alignment, copy, spacing, and restraint.
- Functional before decorative.

### Brand Boundary

MockMate may feel familiar to users of ChatGPT, but it must not reproduce
OpenAI's exact brand, marks, copy, iconography, or precise styling. Use the
interaction pattern, not the brand identity.

## Design Principles

### Conversation First

All primary practice flows should resolve toward a chat thread and a composer.
Controls, filters, and metadata should support the conversation rather than sit
above it as the main visual object.

### Low Chrome

Reduce persistent UI noise. Avoid large headers, thick cards, decorative sections,
and colorful dashboards. The app should feel like a tool users can keep open for
hours.

### Clear Control

Users must always understand:

- which practice mode they are in,
- which role/difficulty/model is active,
- whether their API key is valid,
- whether the AI is generating,
- whether they are expected to answer,
- whether a session has been saved or completed.

### Readable Under Pressure

Interview practice is cognitively demanding. Questions, answers, feedback, and
resume project details must be easy to scan. Do not use narrow text columns,
low-contrast labels, or decorative treatments that make long AI content harder to
read.

## Visual System

### Palette

The product uses a ChatGPT-like light neutral base with sparse MockMate blue.

| Token | Value | Use |
|---|---:|---|
| `{colors.canvas}` | #f7f7f8 | App background and sidebar background |
| `{colors.canvas-elevated}` | #fbfbfc | Slightly lifted workspace background |
| `{colors.surface}` | #ffffff | Main panels, composer, modals |
| `{colors.surface-muted}` | #f4f4f5 | Hover rows, soft chips, setup fields |
| `{colors.border-soft}` | #ececf0 | Hairline panel borders |
| `{colors.border}` | #d9d9e3 | Inputs, active neutral outlines |
| `{colors.border-strong}` | #b8b8c6 | Focus-adjacent neutral borders |
| `{colors.text-strong}` | #111827 | Headings, message body, important values |
| `{colors.text}` | #24292f | Default text |
| `{colors.text-muted}` | #6b7280 | Helper text, metadata, timestamps |
| `{colors.text-soft}` | #9ca3af | Disabled and low-priority text |
| `{colors.primary}` | #2563eb | Primary actions, active route, focus accent |
| `{colors.primary-hover}` | #1d4ed8 | Primary hover/pressed |
| `{colors.primary-soft}` | #eff6ff | Subtle selected and AI-assist tint |
| `{colors.on-primary}` | #ffffff | Text on primary buttons |

### Semantic Colors

Use semantic color only when there is semantic meaning:

| Token | Value | Use |
|---|---:|---|
| `{colors.success}` | #16a34a | Valid API key, completed session, strong score |
| `{colors.warning}` | #d97706 | Medium score, fallback parser, partial warning |
| `{colors.danger}` | #dc2626 | Invalid API key, errors, destructive actions |
| `{colors.info}` | #0284c7 | News prompt, neutral system information |

Difficulty chips may use semantic tones, but large user message surfaces should
not use warning/danger colors unless the content is actually a warning or error.

### Gradients

Gradients are not a primary design language.

Allowed:
- Small MockMate wordmark accent.
- Tiny auth preview accent.

Not allowed:
- Full-screen animated gradient backgrounds.
- Gradient headings throughout the app.
- Decorative floating shapes or orbs.
- Large hero-style gradient panels.

### Typography

Use Inter for display and body. It is already loaded by the frontend and fits the
intended AI workspace tone.

| Token | Size | Weight | Line Height | Use |
|---|---:|---:|---:|---|
| `{typography.app-title}` | 18px | 700 | 1.25 | Sidebar brand |
| `{typography.page-title}` | 24px | 650 | 1.25 | Auth and workspace empty states |
| `{typography.section-title}` | 17px | 650 | 1.35 | Panel headings |
| `{typography.message}` | 15px | 400 | 1.65 | Questions, answers, feedback |
| `{typography.body}` | 14px | 400 | 1.5 | Default UI copy |
| `{typography.body-sm}` | 13px | 400 | 1.45 | Metadata and helper copy |
| `{typography.label}` | 12px | 600 | 1.35 | Setup labels and sidebar metadata |
| `{typography.button}` | 14px | 600 | 1.2 | Button labels |
| `{typography.code}` | 13px | 400 | 1.5 | Model IDs, code snippets |

Typography rules:
- Do not use hero-scale type inside the authenticated app.
- Do not use negative letter spacing.
- Use sentence case for most labels. Reserve uppercase for table headers or very
  small metadata.
- Long AI output should use generous line-height and natural markdown spacing.

### Radius

| Token | Value | Use |
|---|---:|---|
| `{rounded.sm}` | 8px | Sidebar nav items, small chips |
| `{rounded.md}` | 12px | Buttons, inputs, selects |
| `{rounded.lg}` | 16px | Composer, setup panel, content panels |
| `{rounded.xl}` | 20px | Auth card, large modals |
| `{rounded.pill}` | 9999px | Status pills and avatars |

### Elevation

The app should feel mostly flat with careful separation.

| Level | Treatment | Use |
|---|---|---|
| Canvas | Neutral background | App shell |
| Hairline | 1px border | Sidebar, composer, setup panel |
| Soft raised | Border + `0 8px 24px rgba(17,24,39,0.06)` | Composer, floating mobile drawer, modals |
| Overlay | Backdrop + raised panel | Dialogs and previews |

Avoid heavy hover elevation. Subtle background change is preferred for nav items,
records, and setup controls.

## Target Layout

### App Shell

`app-shell` is the authenticated product frame.

Desktop:
- Two columns.
- Left sidebar width: 260px expanded.
- Main workspace fills remaining width.
- Main workspace uses full viewport height and manages its own scroll regions.

Mobile:
- Sidebar becomes a drawer.
- Top mobile bar contains menu button, current workspace title, and user/API key
  status affordance.
- Composer remains reachable at the bottom of chat pages.

### Sidebar Navigation

`sidebar-nav` replaces the old top Tabs as the target primary navigation pattern.

Contents:
- MockMate brand at top.
- Primary nav items: Interview Chat, Resume Drill, History, Progress.
- API key status row.
- Daily practice count.
- GitHub link.
- User menu and logout at bottom.

Behavior:
- Active route uses subtle surface background, thin border, and primary blue
  indicator.
- Inactive route uses neutral text and no heavy decoration.
- Sidebar content should not feel like a marketing nav. It is workspace chrome.

### Workspace Main

`workspace-main` is the right-side content region.

Rules:
- No large top marketing header.
- No primary navigation tabs.
- Use a narrow centered chat column for conversation pages.
- Use wider panels for History and Progress.
- Keep scroll ownership clear: sidebar scrolls independently from main content.

### Practice Setup

`practice-setup-panel` replaces the old always-visible settings row.

Default state:
- Compact summary row near the top of Chat or inside the empty state.
- Shows chips for position, difficulty, question type, question count, follow-up
  count, language, and model.
- Includes a clear affordance to expand settings.

Expanded state:
- Uses grouped controls for role, question behavior, AI settings, API key, and
  optional job description.
- Does not consume the primary chat area when collapsed.
- On mobile, opens as a sheet or full-width collapsible section above the thread.

## Component System

### `app-shell`

The persistent authenticated layout. It owns sidebar/drawer state, route
navigation, and global workspace chrome. It must not own interview business logic.

### `sidebar-nav`

Primary navigation and account status surface.

Required states:
- active route,
- collapsed/mobile drawer,
- API key valid/checking/invalid/idle,
- logged-in user,
- daily question count.

### `workspace-main`

Route content host. It provides spacing, max-width behavior, and scroll container
structure. It should not wrap every page in a decorative card.

### `practice-setup-panel`

Interview configuration surface.

Controls:
- Position / custom position.
- Question type.
- Difficulty.
- Question count.
- Follow-up count.
- Language.
- Creativity.
- Model.
- API key.
- Optional job description.

It should support collapsed summary chips and expanded editable controls.

### `chat-thread`

Scrollable message region.

Rules:
- Max readable width around 760-860px on desktop.
- Centered in the workspace.
- Supports empty, loading, streaming, active, and evaluated states.
- New messages should not resize fixed chrome.

### `message-bubble`

Message rendering primitive for AI, user, and system messages.

AI message:
- Usually left-aligned or full-width within the chat column.
- Uses white or transparent background depending on context.
- Includes a small neutral AI mark/avatar.

User message:
- Right-aligned.
- Uses neutral light gray surface, not strong blue or warning yellow.
- Max width should allow readable paragraphs without spanning the entire screen.

System message:
- Small, muted, and centered or left-aligned depending on severity.
- Uses semantic color only for true warning/error/success.

### `chat-composer`

Bottom sticky input area for chat pages.

Required contents:
- Textarea.
- Send button.
- Voice input button when supported.
- Loading/disabled state.
- Small hint for `Ctrl/Cmd+Enter`.
- Optional session action such as end session or cancel drill.

Rules:
- Stays visually attached to the chat experience.
- Uses white surface, hairline border, 16px radius, and soft shadow.
- Does not cover the last message; the thread must reserve bottom padding.

### `evaluation-card`

Structured feedback renderer. Do not rely on plain markdown alone for evaluation.

Required sections:
- Score / 100 with score band.
- Summary feedback.
- Strengths.
- Areas for improvement.
- Keywords covered.
- Keywords missed.
- Optional evaluation detail metrics.

Score band:
- 85-100 success.
- 70-84 info.
- 50-69 warning.
- 0-49 danger.

### `resume-inspector`

Secondary left panel used inside Resume Drill.

Contents:
- Resume upload/replace.
- Resume parser status.
- Project list.
- Drill point count.
- Follow-up rounds.
- Project progress.

Rules:
- Should visually align with sidebar and setup panels.
- May collapse on desktop.
- Becomes top collapsible panel or drawer on mobile.

### `auth-preview`

A product preview used on login/register pages.

It should show real MockMate concepts:
- AI interviewer question.
- Candidate answer preview.
- Score feedback preview.
- Role/difficulty/model metadata.

It should not be a generic feature list or animated marketing hero.

### Legacy: `workspace-tabs`

`workspace-tabs` is a legacy structure from the current implementation. It should
not be used as the target primary navigation. During migration, route behavior may
remain the same, but the visible primary nav should move to `sidebar-nav`.

## Page-Level Direction

### Auth

Target:
- Clean near-white page.
- Centered login/register card.
- Product preview panel on larger screens.
- Demo account as secondary action.

Avoid:
- Full-screen animated blue gradients.
- Floating decorative shapes.
- Generic feature list as the main product proof.

### Interview Chat

Target:
- ChatGPT-like central conversation.
- Empty state with concise welcome copy and example practice starters.
- Collapsed setup summary above the conversation or within empty state.
- Bottom sticky composer.
- Evaluation shown as structured card.

Avoid:
- Large decorative robot empty state.
- Permanent multi-row settings toolbar as the top visual anchor.
- Card-within-card chat presentation.

### Resume Drill

Target:
- Resume inspector + drill conversation.
- Same message and composer language as Interview Chat.
- Neutral project progress indicators.
- Parsed resume preview in modal or drawer.

Avoid:
- Warning-colored user answer bubbles.
- Warm/cream sidebar that clashes with the main app shell.
- Separate visual language from Interview Chat.

### History

Target:
- Clean record list or table in a wide workspace panel.
- Compact stat summary at top.
- Detail modal with clear question/answer/feedback sections.

Avoid:
- Overly colorful stat cards.
- Heavy card stacks.
- Decorative score treatments that obscure scannability.

### Progress

Target:
- Quiet analytics page.
- Small metric cards.
- Restrained chart color mapping.
- Clear score trends and position breakdown.

Avoid:
- Dashboard clutter.
- Random color strips.
- Large chart decoration unrelated to scores.

### News Questions

Target:
- Compact info/action surface.
- Appears as a contextual prompt, not a dominant card.
- Uses info blue only for true news affordance.

## Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| `< 640px` | Sidebar drawer, mobile top bar, single-column pages, bottom composer remains reachable |
| `640-1024px` | Sidebar may remain drawer or compact rail; setup panel wraps cleanly |
| `1024-1280px` | Full sidebar, centered chat column, wider history/progress panels |
| `> 1280px` | Main workspace may expand, but chat thread remains readable width |

Mobile rules:
- No horizontal scrolling for chat/composer/setup controls.
- Sidebar drawer must close after route selection.
- Composer must not overlap messages.
- Long model names, custom positions, and markdown content must wrap or truncate
  intentionally.

## Motion

Use motion sparingly:
- Soft fade/slide for sidebar drawer, setup expansion, modal open, and new message.
- Small loading affordance for streaming AI output.
- Button press feedback can remain subtle.

Do not use decorative looping animations in the authenticated workspace.

## Accessibility

- Maintain visible keyboard focus.
- Pair status color with icons or text.
- Keep composer controls keyboard accessible.
- Modal and drawer focus should be trapped while open.
- Chat content must remain real text, not images.
- Preserve contrast for muted metadata and soft chips.
- Voice input controls must expose clear labels/tooltips.

## Do's and Don'ts

### Do

- Make conversation the primary surface.
- Use left sidebar navigation instead of top Tabs.
- Keep the composer at the bottom of chat pages.
- Use MockMate blue sparingly for action and state.
- Use real product preview content on auth pages.
- Use structured evaluation cards for score feedback.
- Reuse MUI Joy and existing route/API/store contracts.

### Don't

- Do not copy ChatGPT/OpenAI branding, marks, or exact styling.
- Do not keep top Tabs as the target primary navigation.
- Do not use full-screen animated gradients.
- Do not add marketing hero sections inside the authenticated app.
- Do not use decorative floating shapes or orbs.
- Do not make the interface a stack of nested cards.
- Do not use warning/danger colors for ordinary user messages.
- Do not introduce new backend API requirements for this visual refactor.

## Implementation Sequence

1. Update this design document first.
2. Refine `theme.ts` tokens to match the ChatGPT-like light neutral system.
3. Introduce `app-shell` and `sidebar-nav`, replacing visible Tabs as primary nav.
4. Refactor Interview Chat around `chat-thread`, `message-bubble`,
   `chat-composer`, and `practice-setup-panel`.
5. Align Resume Drill with the same chat/composer language and add
   `resume-inspector`.
6. Restyle History and Progress as quiet workspace pages.
7. Restyle Auth with `auth-preview`.
8. Verify desktop and mobile flows before considering additional polish.

## Acceptance Criteria

- The document explicitly defines the target as a ChatGPT-like product-level
  frontend refactor.
- Top Tabs are documented only as legacy, not as the target structure.
- `app-shell`, `sidebar-nav`, `chat-composer`, `message-bubble`, and
  `evaluation-card` have explicit design rules.
- Existing React, Vite, MUI Joy, Inter, routes, API layer, and store contracts are
  preserved.
- Future implementers should not need to decide what "ChatGPT-like" means for
  layout, color, or core components.

## Known Gaps

- Dark mode is not specified.
- Exact microcopy for empty states and auth preview should be written during
  implementation.
- Detailed chart palette should be finalized while restyling Progress.
- True conversation-history sidebar is out of scope unless a backend or local
  history model is added later.
