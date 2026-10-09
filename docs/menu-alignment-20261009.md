# Alinhamento dos menus — 09/10/2026

Estado: **pronto e validado localmente; publicação autorizada, mas não iniciada**.

O usuário pediu refatoração do alinhamento dos menus e publicação. Essa autorização vale para este ajuste de navegação, sem reincorporar as funcionalidades arquivadas na restauração anterior.

## Mudança

O cabeçalho passou a ter um ponto único de definição de layout em `src/navigation.css`, importado após as camadas antigas. O identificador `site-navigation` impede que os estilos históricos sobrescrevam a geometria. Foram alinhados cabeçalho, busca, navegação, controles, painel móvel e lateral, usando uma altura compartilhada para os deslocamentos.

No desktop os quatro controles têm 44px de altura e a mesma coordenada vertical. A faixa intermediária usa duas linhas a partir de 821px até 1359px, evitando cortes dos nomes. Em até 820px o cabeçalho tem 64px, a barra inferior apresenta cinco células iguais e o painel expõe HUD, idioma, sessão e formato em uma grade explícita. Em até 360px o painel usa uma coluna. A lateral mantém as mesmas colunas para códigos e rótulos; o hover não desloca os itens.

Itens, rotas, tema, logo, dados públicos, Worker, identidade de hospedagem e binding DB foram conservados. Não foi recolocado o Deck Lab, mapa novo, importador Discord ou pacote ST11–ST14. A busca ganhou um rótulo acessível.

## Verificação

- 173 testes JavaScript aprovados, zero falhas.
- Build Vite final aprovado; bundle `index-DHA8Og4I.js`.
- QA da home e do catálogo, em larguras entre 320 e 1440px, incluindo as transições 820/821 e 1359/1360, português e inglês.
- Todos os cinco nomes da navegação cabem nas células nos tamanhos finais conferidos.
- No compilado desktop: controles com 44px e y=15,5; cabeçalho de 76px; lateral começa exatamente em y=76.
- Painel móvel: controles visíveis, colunas e linhas alinhadas; Escape fecha o painel e devolve foco ao botão.
- Payload web/dist continua SHA256 `b6bae7179bea93c5750f084d2bff538386d283d344c104e37b7f982a615c218f`, com 892 cartas e 107 recursos. Worker fonte/dist iguais, sem mudança.
- Revisão independente do diff aprovada. Não foram introduzidas migrações ou configurações de produção.

## Publicação

A consulta nativa ao mesmo projeto Sites falhou localmente com `TypeError: tools.mcp__codex_apps__sites_get_site is not a function`, antes de qualquer requisição remota. Não há comandos executáveis de consulta, credencial, salvamento, deploy ou descoberta de plugins nesta sessão.

Não houve credencial, push de fonte, versão remota ou deploy. O site online não foi alterado. A próxima publicação deve usar o fluxo nativo do mesmo projeto, preservar audiência e binding e levar somente esta versão validada de menus sobre o payload restaurado. Não usar o build amplo para incluir dados novos sem revisar seu escopo. Se os inputs mudarem, validar o delta antes de publicar. Não solicitar novamente a autorização para estes menus.
