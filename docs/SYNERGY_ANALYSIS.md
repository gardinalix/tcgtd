# Synergy Analysis

The MVP synergy system runs inside the existing React tactical UI and does not alter card data.

## Current MVP

- `src/services/synergyAnalyzer.js`: calculates source-card to target-card synergy.
- `src/services/synergyRulesEngine.js`: stores rule weights, rank thresholds and algorithm version.
- `src/services/synergyTextParser.js`: extracts traits, keywords, support roles and textual bridges.
- `src/services/synergyCacheService.js`: in-memory cache keyed by source card, data snapshot and algorithm version.

## Signals Used

- Direct LINK/PAIR references through `linkTargets`.
- Shared traits and synergy tags.
- Shared archetype signals from card meta data.
- Co-occurrence in normalized event decklists.
- Textual references in card text only, not invented card text.
- Same color and complementary cost curve heuristics.
- Support text patterns such as protection, draw, removal, recursion, setup and finisher.

## Ranks

- High synergy: score 80-100.
- Good synergy: score 50-79.
- Low synergy: score 20-49.
- Below 20 is hidden by default.

## Future Backend Cache

The persistent schema is prepared in `migrations/20260511_synergy_analysis.sql`:

- `card_synergy_cache`
- `synergy_rules`
- `synergy_feedback`
