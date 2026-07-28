# Meta Signal Rules

Meta Signal converts event/decklist history into tactical card bands.

## Bands

- `Staple`: very high recent Top 16 presence or recent score.
- `Meta relevante`: recurring competitive usage.
- `Sideboard/meta call`: lower but meaningful event usage.
- `Low cost util`: useful and low-price cards with evidence of play.
- `Watch`: early signal or historical relevance.
- `Bulk`: no current competitive signal.
- `Nao classificada`: no local review yet.

## Current Calculation

The initial frontend calculation uses:

- recent Top 16 deck appearances,
- all-time Top 16 appearances,
- recent meta score,
- overall meta score,
- price signal for low-cost useful cards,
- archetype trends from the advisor snapshot.

## History Rows

Use `meta_signal_history` when a card changes band.

Required fields:

- card number,
- previous band,
- new band,
- change date,
- reason,
- source,
- related event/decks when available.

Example reason:

`GD04-XXX moved from Watch to Meta relevante because it appeared in 5 Top 16 lists in the last 14 days.`
