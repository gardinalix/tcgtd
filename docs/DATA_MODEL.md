# Data Model

The current production seed is SQLite at `data/gundam.db`. Platform tables are defined in `migrations/20260510_functional_platform.sql`, auth extensions in `migrations/20260510_auth_complete.sql`, and synergy extensions in `migrations/20260511_synergy_analysis.sql`.

## Core Tables

- `users`: account profile, role, public name, username, avatar, provider, provider id, password hash, ban flag and preferences.
- `auth_identities`: OAuth provider links for Google, Discord and Facebook.
- `auth_sessions`: hashed persistent session tokens for `httpOnly` cookies.
- `password_reset_tokens`: hashed password recovery tokens.
- `auth_logs`: login, logout, registration, reset and provider events.
- `cards`: official card printings already imported from Bandai.
- `sets`: products/sets normalized for joins.
- `decks`: user and public deck metadata.
- `deck_cards`: card quantities by deck and section.
- `collections`: user-owned card quantities, status, condition, language, manual price, classification, and alerts.

## Competitive Tables

- `events`: tournament/event records.
- `event_decklists`: event result rows associated to decklists.
- `meta_signal_current`: latest tactical classification per card.
- `meta_signal_history`: movement log when cards change bands.

## Synergy Tables

- `card_synergy_cache`: cached source-card to target-card synergy scores, rank, types, explanation, evidence, timestamp and algorithm version.
- `synergy_rules`: configurable scoring rules with weight and enabled flag.
- `synergy_feedback`: user feedback on whether a suggested synergy makes sense or should be adjusted.

## Preview Tables

- `previews`: official/semi-official preview queue with source, status, translation, and reliability.
- `preview_sources`: raw source references for preview traceability.

## Source And Import Tables

- `data_sources`: configured collectors/import sources.
- `source_runs`: execution logs.
- `source_items`: raw and normalized item payloads.
- `imports`: manual CSV import runs.
- `audit_logs`: authentication and user action history.

## Frontend State

The React app uses the auth server when available and keeps local fallback state for offline/dev continuity. Production login, register, logout, session, and profile flows are backed by `server/authServer.mjs`.
