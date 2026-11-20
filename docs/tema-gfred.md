# Tema GFreD / Alphaciders

Tema opcional no seletor HUD / UNIT. Roxo violeta `#c49bff`, lilás `#e1ccff` e fundo ameixa `#10091b`, com um pequeno detalhe verde no emblema. A preferência usa o armazenamento de tema existente e vale para todas as rotas.

- Unidade `gMS-κ`, piloto Nyaan, conforme a [referência oficial](https://gundam-official.com/gquuuuuux/mecha/31/).
- Arte original da unidade: `web/assets/gundams/gfred.png`, obtida da imagem frontal da página oficial.
- Miniatura do cockpit: `web/assets/gundams/gfred-blueprint.webp`, esquemático violeta/lilás de corpo inteiro com transparência, gerado pela ferramenta integrada a partir da arte original e do `gquuuuuux-blueprint.webp` como referência de estilo. O quadro, o enquadramento e a mistura luminosa seguem os demais temas.
- Fundo: `web/assets/backgrounds/gfred-alphaciders-cockpit.webp`, gerado com a ferramenta integrada de imagens a partir de `gquuuuuux-izuma-cockpit.webp`, convertido para WebP. O console usa a carcaça compartilhada, com iluminação violeta aplicada somente à ilustração.
- `web/assets/factions/alphaciders.svg` é um emblema geométrico criado para este tema, sem pretensão de ser um símbolo oficial da facção.
- A carta preferida da piloto é `GD06-094_p1`, já disponível no catálogo.

Prompt final do fundo (ferramenta integrada, sem CLI):

> Use case: lighting-weather. Asset type: wide 16:9 illustrated background for GFreD Gundam tactical cockpit theme. Edit reference image: preserve this panoramic physical metal cockpit window, exterior orbital colony and composition. Change lighting identity to rich violet and lilac: dark plum titanium framing, vivid violet cockpit light strips replacing pink, muted lavender reflected light, very subtle mint secondary indicators, deep purple nebula space. Lower brightness of the glaring spherical colony to preserve readable HTML overlaid on center-left. Premium anime sci-fi painted environment, crisp details. Keep window scene fully environmental, no text, no UI screens, no logos, no characters or mecha. Full bleed wide image.

Prompt final da miniatura (ferramenta integrada, sem CLI):

> Use case: style-transfer. Create the matching GFreD technical schematic thumbnail for an established Gundam cockpit theme. Image 1 is the EDIT TARGET and exact GFreD identity/geometry reference. Image 2 is STYLE REFERENCE ONLY: match its luminous technical line drawing, wireframe armor edges, intricate internal mechanical lines, full-body 3/4 standing view and tall portrait composition. Convert ONLY the mecha in image 1 into that technical schematic style. Preserve GFreD's exact silhouette, very long twin head antennae, head shape, shoulder armor, torso, arm and leg proportions, distinctive foot armor and rear shield/backpack from image 1. Do NOT substitute the horned helmet or weapon of image 2 and do not invent a rifle. Primary outlines violet/lilac #c49bff and pale lavender #e1ccff, subtle mint #9ce4cb internal sensor details. Dark translucent plum interiors instead of flat multicolor painted armor. Crisp luminous delicate drafting lines with restrained glow, readable in a 170x220 px HUD. Whole body from antenna tips to soles, centered and large in frame, modest 5% padding, front three-quarter pose. Genuinely transparent background including all outer margins, no white rectangle, no black rectangle, no opaque colored glow backdrop, no text, no labels, no dimensions, no floor or scenery. Final output portrait roughly 2:3, PNG with actual alpha.
