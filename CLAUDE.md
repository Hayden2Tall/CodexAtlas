# CodexAtlas — Claude Code Instructions

## Stack
Next.js App Router · TypeScript · Tailwind CSS v4 · Supabase · Anthropic Claude API · Vercel

## Dark mode — REQUIRED on all UI work

**Every component or page change that touches UI MUST include correct dark mode classes.**

Dark mode uses class-based toggling (`@custom-variant dark (&:is(.dark *))` in `globals.css`). The `.dark` class is on `<html>`.

### Quick mapping

| Light | Dark |
|---|---|
| `bg-white` | `dark:bg-gray-900` |
| `bg-gray-50` | `dark:bg-gray-800/50` |
| `bg-gray-100` | `dark:bg-gray-800` |
| `border-gray-200` | `dark:border-gray-700` |
| `border-gray-100` | `dark:border-gray-800` |
| `text-gray-900` | `dark:text-gray-100` |
| `text-gray-700` / `text-gray-800` | `dark:text-gray-300` / `dark:text-gray-200` |
| `text-gray-600` / `text-gray-500` | `dark:text-gray-400` |
| `text-primary-700` | `dark:text-primary-400` |
| `bg-primary-50` | `dark:bg-primary-900/50` |
| `placeholder-gray-400` | `dark:placeholder-gray-500` |

### Panel patterns
```
White card:   border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900
Gray panel:   border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50
Blue panel:   border-blue-100 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/10
Amber panel:  border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10
```

### Before completing any UI task
- [ ] No white/light backgrounds visible in dark mode
- [ ] No unreadable text (dark on dark or light on light)
- [ ] All inputs/selects have `dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100`
- [ ] Progress bar tracks use `dark:bg-gray-700`
- [ ] Confirm dialogs use `dark:bg-gray-800 dark:border-gray-700`

Full standards: `docs/UX_GUIDELINES.md` §7.5

## Constitution
`docs/PROJECT_CONSTITUTION.md` governs all architectural decisions.

## No soft deletes
Use `archived_at` timestamp — never hard-delete records.

## Role system
`ADMIN_ROLES = ["admin", "editor", "contributor"]`
`SCHOLAR_AND_ABOVE = ["scholar", "editor", "admin", "contributor"]`
