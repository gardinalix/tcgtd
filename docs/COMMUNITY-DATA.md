# Community data policy

## Product goal

Connect public event records into a useful graph:

```text
event → venue → players → standings → decks → cards
```

The interface may use another product as functional research, but the TCG Tactical Database must keep its own code, copy, visual hierarchy and data pipeline.

## Current coverage

The generated snapshot currently contains competitive events, result rows, public player handles and some organizer names. It does not contain reliable city, state, country, postal address, latitude or longitude fields.

The UI therefore exposes events, results and an observed-player directory immediately, while the map stays explicitly unpopulated until geographic records are sourced.

## Source rules

- Do not copy TDGR code, private endpoints, datasets, copywriting or assets.
- Import community records only from a declared source with a source URL and capture/verification timestamp.
- Prefer official event information and organizer-provided feeds or exports.
- Keep event facts, community submissions and calculated rankings distinguishable.
- Never mark a player as linked to a Bandai account without an explicit identifier and a verification step.
- Never infer a store address or map coordinate from an ambiguous event name.
- Retain corrections and source history so outdated weekly schedules can be disabled rather than silently overwritten.

## Next ingestion target

The official Gundam Card Game site directs store events and player registration through BANDAI TCG+. Before automating ingestion, confirm a permitted export, API or organizer workflow. Until then, the product should link users to official event information for live availability and use its own normalized dataset for historical results.

Card-data services such as GCGAPI and `apitcg/gundam-tcg-data` are not event sources. GCGAPI may be used as an external card-catalog audit, while event ingestion must retain its own declared event or organizer source.
