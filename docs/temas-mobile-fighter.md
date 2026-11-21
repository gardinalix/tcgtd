# Shining Gundam e Master Gundam

Dois temas opcionais no seletor HUD / UNIT, entregues na mesma publicação. Compartilham a geometria dos cockpits e das miniaturas dos temas existentes, com CSS limitado aos IDs `shining` e `master`. A preferência usa o armazenamento existente e acompanha todas as rotas.

| Tema | Cores | Unidade | Piloto | Carta preferida |
| --- | --- | --- | --- | --- |
| Shining Gundam | Dourado `#ffd166`, verde `#69e6b3`, carvão quente | GF13-017NJ | Domon Kasshu | GD05-097_p1 |
| Master Gundam | Rubi `#ff667a`, violeta `#bd9aff`, obsidiana | GF13-001NHII | Master Asia | GD05-089_p1 |

Fontes das unidades e dos pilotos: [Shining Gundam](https://www.g-gundam.net/mf/detail.php?id=1) e [Master Gundam](https://www.g-gundam.net/mf/detail.php?id=10), no site oficial. As imagens originais estão em `web/assets/gundams/shining.png` e `web/assets/gundams/master.png`; mantêm as vistas oficiais. As miniaturas do cockpit mostram somente uma figura frontal, de corpo inteiro, sem recortar antenas ou pés.

Arte criada com a ferramenta integrada de imagens, sem CLI. Os PNGs gerados foram convertidos para WebP, preservando o canal alfa nas miniaturas. Os emblemas SVG são desenhos geométricos originais para os temas, sem pretensão de representar símbolos oficiais. O console inferior reutiliza a carcaça comum com iluminação própria; os controles permanecem em HTML.

## Prompts finais e arquivos

### `web/assets/backgrounds/shining-guiana-cockpit.webp`

Referência visual: `gfred-alphaciders-cockpit.webp` para a moldura física e a linguagem de ilustração.

> Use case: precise-object-edit. Asset: wide 16:9 Shining Gundam cockpit environment for TCGTD website. Reference is the established physical cockpit/window framing and illustration style. Keep the wide panoramic mechanical window and edge-mounted armor framing; replace the exterior space colony entirely with a beautiful Earth training landscape inspired by Guiana Highlands in Mobile Fighter G Gundam: sheer tropical table mountains, distant waterfalls and low mist at warm dawn. No characters and no mecha. Interior brushed gunmetal with ivory armor trim, strong amber/gold light strips and small emerald-green sensor rails. Rich gold/green theme, deep charcoal shadows, clear center-left negative space for HTML text and controls. Bright sunrise toward far right, keep center-left darker for readability. Detailed premium anime sci-fi concept illustration. No text, no fake UI, no logos, no charts, no watermark. Landscape fills panoramic viewport, cinematic and tactile.

### `web/assets/backgrounds/master-hongkong-cockpit.webp`

Referência visual: `gfred-alphaciders-cockpit.webp` para a moldura física e a linguagem de ilustração.

> Use case: precise-object-edit. Asset: wide 16:9 Master Gundam cockpit environment for TCGTD website. Reference is only the established physical cockpit/window framing and detailed illustration style. Keep the panoramic mechanical window framing, replace exterior space scene completely with an atmospheric Neo Hong Kong martial tournament arena waterfront at twilight: distant futuristic harbor skyline and old stone circular fighting platform, stormy purple clouds, crimson horizon reflected on water, no people, no characters, no mecha. Interior dark obsidian segmented armor, angular dark red metal trim, ruby red command light strips with secondary amethyst-violet sensor rails, subtle pale silver edge highlights. Master Gundam mood: disciplined, imposing martial arts, black/crimson/violet. Keep central-left exterior darker and calm for real HTML text overlay, richer skyline toward right. Premium painted anime sci-fi environment, crisp physical details. No text, no logos, no fake UI, no instruments drawn over viewport, no watermark.

### `web/assets/gundams/shining-blueprint.webp`

Referências: `shining.png` para a unidade, `gfred-blueprint.webp` para o estilo esquemático.

> Use case: style-transfer. Asset: Shining Gundam technical schematic thumbnail for TCGTD cockpit. Image1 is exact unit geometry reference: use ONLY the single FRONT three-quarter full-body figure on LEFT. Ignore back view. Image2 is STYLE reference ONLY: match luminous fine technical wireframe edges, translucent dark armor interiors, internal machinery lines and whole-body standing composition. Depict a SINGLE Shining Gundam in normal mode, accurate classic broad upright shoulder armor, yellow V-fin, round chest gem, characteristic forearm guards and bulky lower legs/feet. Preserve design from image1; no GFreD antennae, no rifle, no extra weapons. Primary luminous GOLD #ffd166 and pale ivory-gold #fff0bd outlines with EMERALD #69e6b3 sensor and hand-energy details, restrained glow. Full body antenna tips through soles, centered, about 90% of tall portrait canvas, readable at 170x205 px. Actual transparent background, no black/white rectangle, no scenery, no floor, no text, no labels, no measurements. Single figure, no second rear view.

### `web/assets/gundams/master-blueprint.webp`

Referências: `master.png` para a unidade, `gfred-blueprint.webp` para o estilo esquemático.

> Use case: style-transfer. Asset: Master Gundam technical schematic thumbnail for TCGTD cockpit. Image1 is exact unit geometry reference: use ONLY the single FRONT three-quarter full-body figure on LEFT, ignore smaller back view. Image2 is STYLE reference only: fine glowing technical wireframe linework, translucent dark armor interiors, internal mechanical detail. Depict ONE accurate Master Gundam with distinctive very long lateral swept pointed helmet crest, circular black shoulder armor, tall unfolded wing/cape structures behind shoulders, solid martial-arts physique and pointed lower leg guards. Preserve silhouette and original proportions from image1, especially head and cape. Do not use GFreD's upright antennae, do not invent rifle or weapons. Full-body standing three-quarter stance, antenna/crest tips through soles, centered with 5% margin tall portrait composition. Primary luminous RUBY RED #ff667a with pale rose highlights, secondary AMETHYST #bd9aff internal detail, obsidian translucent armor. Crisp restrained glow readable at 170x205px. Genuinely transparent background; no opaque black rectangle, no scenery, no text, no labels, no floor, no second rear view.
