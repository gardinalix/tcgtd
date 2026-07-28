# Import Templates

CSV templates live in `templates/imports`.

## Available Templates

- `cards_template.csv`: manual card import/review.
- `decklists_template.csv`: public or user decklists.
- `events_template.csv`: event and tournament results.
- `previews_template.csv`: official previews/leaks review queue.
- `meta_signal_template.csv`: manual meta band changes.

## Rules

- Do not invent card names, effects, or rarity.
- Keep source URLs whenever possible.
- Use official preview statuses until a card is confirmed.
- Deck quantities accept normal section names: `main` and `resource`.
- Decklist text import accepts `4x GD01-086` and `4xGD01-086`.
- ExBurst profile import accepts public Gundam decklists from `https://exburst.dev/profile/{userId}` or a numeric ExBurst user id.
- ExBurst alternate ids such as `ST03-013-ALT3` are normalized to the base card id (`ST03-013`) so they match the local card database.
- Private ExBurst decklists are not fetched by this project. Export/paste them manually unless ExBurst provides an authorized API flow.

## Initial Workflow

1. Download or copy a template.
2. Replace the example row.
3. Import through the matching ingestion script.
4. Review rejected rows.
5. Rebuild `web/app-data.json` before deploying static updates.
