# Checagem de preços da LigaGundam — 20/11/2026

A busca pública funciona em acesso normal pelo navegador. As requisições do coletor HTTP retornaram HTML de verificação Cloudflare (`Just a moment...`), sem anúncios, inclusive com resposta HTTP que não denunciava o bloqueio. Não houve mudança de credenciais, configuração live ou tentativa de contornar o desafio.

## Problemas corrigidos

- O coletor interpretava a página de desafio como resultado vazio. Agora valida a página, registra `blocked`, interrompe a fila e retorna erro.
- O caminho de fallback do transporte podia entregar HTML de erro ao parser. A validação acontece depois do transporte, independentemente do método usado.
- O cache retido recebia a data da tentativa atual. Agora cada anúncio conserva sua observação; a comparação usa a data do anúncio efetivamente escolhido. Uma tentativa sem sucesso não escreve os CSVs nem substitui o snapshot de preços.
- Uma falha no início podia disparar centenas de buscas já enfileiradas. A coleta é sequencial, aceita somente um worker e interrompe no primeiro bloqueio ou erro de transporte.
- A mescla de uma observação nova podia manter outra URL do mesmo anúncio com preço antigo. A atualização substitui a identidade `listing_id + edition_code` e preserva anúncios de outras edições.
- Uma consulta exata bem-sucedida sem anúncio agora retira a observação anterior desse número, sem classificá-la como atual.

`data/ligagundam_scan_report.json` separa tentativa, estado do acesso automático, método usado e datas das observações. O build projeta um resumo público em `priceSources.ligagundam`. Archive e Mercado mostram a situação da coleta, e os detalhes dos preços mostram a data observada.

## Importação de observações do navegador

O coletor aceita `--browser-snapshot CAMINHO.json`. Essa opção importa dados visíveis consultados por acesso normal, valida o domínio, o número na URL e a data, e mescla as observações sem fazer requisições HTTP. Não use `--fresh` nessa importação. Preços zero/ausentes não são tratados como novas ofertas.

Formato:

```json
{
  "source_url": "https://www.ligagundam.com.br/?view=cards/search&card=Infinite+Justice+Gundam",
  "observed_at_utc": "2026-11-20T12:53:08+00:00",
  "listings": [{
    "listing_id": "GD06-002",
    "title": "Infinite Justice Gundam",
    "url": "https://www.ligagundam.com.br/?view=cards/card&ed=GD06&num=GD06-002",
    "low": 51.74,
    "avg": 71.72,
    "high": 109.90
  }]
}
```

Depois da coleta, o pipeline normal reconstrói SQLite e os dados públicos. Em uma publicação concorrente, compare os dados com o live mais recente antes de reconstruí-los a partir dos caches locais.

## Verificação desta correção

Foram conferidos na busca pública e importados os três anúncios de Infinite Justice Gundam: base **R$ 51,74**, LR+ **R$ 224,90**, LR++ **R$ 3.750,00**. Os demais **1.579 anúncios** conservam suas datas anteriores. Testes cobrem bloqueio, interrupção da fila, preservação integral dos arquivos, datas em coleta parcial, retirada após busca exata vazia, parser e importação pelo navegador.

A atualização automática completa continua dependendo de acesso HTTP permitido pela Liga ou de uma integração autorizada fornecida pela fonte. A importação pelo navegador permite atualizações conferidas enquanto essa dependência externa permanece.
