# Functional Roadmap

This project keeps the existing ZERO System cockpit UI and adds platform capabilities in phases.

## Phase 1: Accounts And Decks

- Local-first profile/session shell with visitor and user roles.
- Saved decks, public/private visibility, deck duplication, deck import/export, and deck validation.

## Phase 2: Events, Public Decklists, Meta Signal

- Events page fed by normalized meta/event data.
- Public/meta decklists with filters by color, format, event, archetype, and source.
- Meta Signal Monitoring based on recent appearances, Top 16 presence, archetype recurrence, and score movement.

## Phase 3: Preview Radar And Deck Imports

- Official previews and leaks queue with status, source, reliability, translation fields, and conversion workflow.
- Public ExBurst deck imports and plain-text deck exports.
- Source run logging for future external collectors.

## Phase 4: Production Backend

- Replace local-first auth with production auth.
- Connect forms to the production database API.
- Add CI/deploy checks and rollback playbooks.

## Functional References

- ExBurst-style functions: card database, deck builder, user decks, sharing, saved decks, public decks, and test/export workflows.
- Egman-style functions: events, tournament results, decklists, format/set pages, rankings, color/archetype breakdowns, and meta history.

No code, visual identity, copy, or assets are copied from those sites.
