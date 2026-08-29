# Tatkal Copilot

**Stop Guessing. Start Winning Tatkal.**

An AI travel agent that prepares you _before_ the Tatkal window opens. It never
books, logs in, or automates anything — it makes you dramatically better
prepared, then hands you off to the official IRCTC site.

Built for the **Build What Moves India** hackathon (OpenAI + Varun Mayya).

---

## The one user

Everything is designed for **Manoj Sharma, 54, Mumbai** — books Tatkal 3–5×/year,
not tech-savvy, usually relies on his son or a travel agent. His goal:
_"I need to reach Delhi before 8AM tomorrow."_

## The one journey

A single continuous story across 8 screens:

1. **Hero** — the promise
2. **Travel Goal** — plain words, speech input ("reach Delhi before 8AM with my wife")
3. **AI Thinking** — visible reasoning, not an instant answer
4. **Strategy** — one confident recommendation (August Kranti, 63%), _why not_ the
   obvious train, the Borivali boarding edge, and a Split-via-Kota backup
5. **Passenger Vault** — saved passengers, one tap
6. **Mission Control** — countdown, live readiness checklist, streaming AI coach
7. **Booking Assistant** — security handoff to the official IRCTC site (new tab)
8. **Demo Completion** — measurable before/after (28% → 63%, 0 → 2 backups)

## How the AI is used (meaningfully, and safely)

The AI does the two things it is genuinely good at:

1. **Understands** Manoj's messy sentence → structured intent.
2. **Explains** the strategy like a seasoned travel agent.

Every **number and the strategy itself stay grounded in mock data** via a
deterministic local planner (`lib/planner.ts`), so GPT can never invent a fake
confirmation figure.

**Dual-path resilience:** with `OPENAI_API_KEY` set, the `/api/plan` route uses
GPT (`gpt-4o-mini`). Without a key — or if the call fails — it falls back to the
local planner and produces the same shape of expert output. **The demo never
breaks in front of judges.**

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To enable the live GPT path:

```bash
cp .env.example .env.local   # add your OPENAI_API_KEY
```

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Framer Motion · Lucide.
Local JSON data, no database, no auth, no backend beyond one API route.

## Architecture

```
app/            layout, page orchestrator, /api/plan (GPT + fallback)
components/      ui primitives (button, card, probability ring), brand chrome
features/        one folder per screen (hero, goal, thinking, strategy, …)
lib/            planner (intelligence), ai (dual-path), i18n (EN/HI), journey state
data/           trains, stations, split routes, passengers, mission script (JSON)
hooks/          countdown, speech
types/          domain model
```

## Principles

- **Never** pretends to connect to IRCTC. Never automates booking. Never scrapes.
- Every screen answers: _"How does this reduce Tatkal anxiety?"_
- Accessibility: WCAG-minded contrast, large targets, EN/हिन्दी toggle, reduced-motion.
