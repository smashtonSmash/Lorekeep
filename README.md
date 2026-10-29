# LoreKeep

A D&D table app for phones: battle, character sheets, loot, town, casino and a DM reference.

## Online play (Supabase) — one-time setup
1. In Supabase, open your project → **SQL Editor** → paste all of `supabase/lorekeep.sql` → **Run**. (Safe to run again; it only adds `lk_` tables.)
2. **Authentication → URL Configuration**: set **Site URL** to `https://smashtonsmash.github.io/Lorekeep/` and add `https://smashtonsmash.github.io/**` under **Redirect URLs**.
3. **Authentication → Sign In / Providers → Email**: keep it on. Turning off "Confirm email" makes password sign-up instant.
4. In LoreKeep tap **📱 This device** → sign in → **Start a campaign** → **Copy invite link** and send it to players.

The project URL and public anon key live in `src/cloud/supabase.ts`.

## Ways to run it
- **Shared table (online play):** publish `dist/artifact.html` as a claude.ai artifact. The owner is the DM. Share it with each player as an **editor**; everyone sees the same campaign live.
- **One device:** open `dist/index.html` anywhere (GitHub Pages works). Data stays in that browser.

## Build
```
npm install
npm run build   # → dist/index.html and dist/artifact.html (single self-contained files)
npm test        # rules tests (bun)
```

## Where things live
- `src/rules/` — all game mechanics and numbers (armor, gear, forge, loot, combat, economy, casino). Pure functions, tested in `tests/`.
- `src/core/store.ts` — one store; local or shared-table backend.
- `src/screens/` — the 8 tabs. `src/ui/` — sheets, inventory, spells, item art.
- `src/data/` — SRD races/classes/backgrounds, expanded origins, a trimmed SRD spell and monster list.

PLACEHOLDER numbers are listed on the DM tab.
