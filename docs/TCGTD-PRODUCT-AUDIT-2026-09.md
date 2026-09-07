# TCGTD — auditoria e evolução do produto

Data: 7 de setembro de 2026. Status: primeira entrega local; sem publicação.

## Decisão de produto

O caminho para um ponto central de Gundam Card Game é conectar quatro jornadas: encontrar uma carta → construir uma lista → estudar resultados → participar da comunidade. O TCGTD já possui essas áreas. A prioridade é corrigir cobertura, linguagem e continuidade entre elas, aproveitando React, Vite, o Worker e o pipeline versionado existentes.

A mecânica analítica do Gundeck é reproduzível com software próprio. A equivalência de dados depende de acesso a partidas com resultado, data e identificação dos decks. Um gráfico semelhante, alimentado apenas com listas de colocados, responderia a outra pergunta.

## Evidências e fontes

| Referência | Observação verificada | Aplicação no TCGTD |
| --- | --- | --- |
| [ExBurst](https://exburst.dev/gundam/) | Navegação separa construção, comunidade e competição; há atalhos para catálogo, listas, coleção e resultados. | Conectar tarefas recorrentes. Evitar um catálogo de funcionalidades que alongue a chegada à tarefa; onboarding obrigatório e publicidade flutuante aumentam interferência. |
| [Egman](https://deckbuilder.egmanevents.com/gundam/deck) | A URL fornecida, sem uma lista, abre um estado de deck vazio. A navegação expõe Build, Deck Database, Meta e Tools; há link para pular ao conteúdo. | Preservar importação/exportação e URLs compartilháveis. Melhorar o estado vazio do TCGTD com ações concretas. Não interpretar a rota vazia como ausência do construtor. |
| [TDGR](https://tdgr.org/browse/) | O diretório indexado conecta cartas, decks públicos, eventos e perfis. A página inicial indexada também descreve coleção e trocas. A inspeção visual atual foi limitada por falhas de DNS e 403. | Adotar a conexão entre entidades, sem alegar ter validado seus gráficos ou formulários. A avaliação detalhada de META/COMUNIDADE do TDGR permanece pendente de acesso funcional. |
| [TCG Top Decks HQ](https://tcgtopdecks-hq.com/gundamcardgame-decks/) | Página de listas vencedoras separa formatos inglês, chinês e japonês. Não foi confirmada uma API pública de ingestão. | Fonte complementar de descoberta de listas, preservando região, formato, evento, colocação e link. Listas sem evento confirmado entram como listas comunitárias. |
| [Gundeck](https://gundeck.ai/) | Declara MSA como origem. A interface mostra janelas temporais, exclusão de mirrors, amostra mínima, participação, confrontos e menção ao limite inferior de Wilson 95%. | Reproduzir cálculos e interação com autoria própria. Exibir taxa bruta e intervalo separadamente; não rotular o limite inferior como taxa observada. Não há comprovação de API de reutilização do Gundeck. |
| [MSA](https://mobilesuitarena.com/#season) | HTML público contém 12 partidas encerradas e 40 entradas de ranking no snapshot consultado. Nas partidas há ID, modo e vencedor, mas não decks nem data da partida. Links de resultado existem; tentativas de leitura falharam por conexão/TLS. O histórico da conta usa autenticação. | Coletor limitado ao índice público. Não inferir temporada, data, arquétipo ou lista com base no momento da coleta ou ranking atual. Falha de transporte não comprova que a página seja privada. |
| [Bandai: resultados oficiais JP](https://www.gundam-gcg.com/jp/tournament-results/) | Índice público de eventos e listas de colocados. | Descoberta oficial por região; adaptador com revisão de mudança de formato e snapshots. |
| [Bandai TCG＋D](https://d.bandai-tcg-plus.com/gcgja/tournament) | Publica índice de torneios oficiais e sancionados. Um detalhe excedeu o limite da ferramenta de leitura. | Prioridade de investigação para dados oficiais de competição. Não presumir API ou cobertura internacional uniforme. |
| [Bandai: First Combat](https://www.gundam-gcg.com/jp/news/event_report_FC.html) | Relatório contém distribuição de decks e links para listas dos colocados. | Exemplo concreto de distribuição oficial, com o campo e a sessão corretos; publicação e data do evento são campos distintos. |
| [Limitless: API](https://docs.limitlesstcg.com/developer.html) | Documentação permite consultar dados de torneios sem chave, com limites de uso. | Caminho documentado para evolução do coletor existente, sem depender de páginas HTML. |
| [Limitless: endpoints](https://docs.limitlesstcg.com/developer/tournaments) | Detalhes, standings e pareamentos. Verificação do evento `6a937e44abb94822375038c8`: 21 participantes, 49 registros de pareamento, 2 byes e 17 participantes com arquétipo diferente de Other. | Viabiliza confrontos de torneios. Excluir byes, tratar empates e derrotas duplas e manter a data do evento como data de evento, sem inventar horário de cada partida. |

O resultado mais útil da pesquisa é ter dois caminhos independentes: MSA para ranqueadas digitais, condicionado aos campos ausentes; Limitless para confrontos de torneios, com interface documentada já verificada. Bandai mantém precedência sobre regras, legalidade e dados oficiais. Fontes públicas consultáveis não equivalem automaticamente a uma autorização de republicação integral de imagens/textos; preferir metadados, links e condições de uso confirmadas para integrações permanentes.

## Mapa do produto atual

| Jornada | Rotas verificadas no código | Base existente / ponto de atenção |
| --- | --- | --- |
| Descobrir | `/`, `/cards`, `/card/:id` | Home leve, catálogo paginado, filtros mobile, variantes, preços e detalhes. Home ainda usa números/rótulos que precisam distinguir resultado e lista indexada. |
| Construir | `/decks`, `/deckbuilder`, `/deck/:id`, `/io` | Forge, ZERO Forge, regras, salvar, importar MSA/ExBurst, exportar texto/imagem, compartilhamento. Preservar essas funções. |
| Analisar cartas | `/synergy/:id`, `/synergy-map/:id` | Motor de sinergia com regras e evidências; não é simulação de vitórias. |
| Competir | `/meta`, `/community/events`, `/community/events/:id`, alias `/events` | Recortes por data, arquétipos, cartas, arquivo de resultados e procedência. Faltavam denominadores claros e separação entre títulos e vitórias. |
| Participar | `/community`, `/community/players`, `/community/stores`, `/community/schedules` | Agendas e exceções já existem. Jogadores são apelidos observados, não identidades Bandai autenticadas. Localização depende de evidência. |
| Consultar mercado e novidades | `/prices`, `/leaks` | Preços, ofertas de parceiros, prévias; manter separação entre dados oficiais, observados e previstos. |
| Conta | `/login`, `/register`, `/logout`, `/auth/callback`, `/profile`, `/settings`, `/settings/account` | Conta, preferências e permissões existentes. Fluxos autenticados completos não foram exercitados nesta etapa. |
| Institucional | `/about`, `/legal`, `/terms`, `/privacy`, `/feedback` | Documentação e feedback. SEO permanece deliberadamente restrito no alpha, conforme configuração atual. |

## Diagnóstico priorizado

1. **P0 — Integridade analítica.** `deckId` sem cartas inflava o denominador de adoção. Resultados com arquétipo indefinido desapareciam da visualização de participação. Não havia baseline explícito para movimentos. Corrigidos nesta entrega os denominadores de cartas e o caso sem período anterior; adicionados resultados sem classificação no painel de cobertura.
2. **P0 — Resultado não é título.** O detalhe de evento usava a primeira linha disponível como vencedor e inferia Top Cut pelo número de linhas. Corrigido: campeão exige uma única linha de colocação 1; primeiros lugares conflitantes mostram revisão pendente; corte não informado fica desconhecido. A validação encontrou 362 avisos de colocações repetidas, inclusive 83 agrupamentos com primeiros lugares conflitantes no recorte histórico. Alguns empates de colocação podem ser legítimos; é necessário revisar a chave do evento e a fonte antes de corrigir. O novo painel informa essa ambiguidade. Não se trata de 362 erros de código nem de 362 eventos necessariamente inválidos.
3. **P1 — Entrada de comunidade.** A plataforma possui agendas, mas não possuía um fluxo simples para preparar resultados de lojas. Implementado formulário de arquivo revisável e importação local, sem fingir envio automático.
4. **P1 — Mobile e leitura.** A inspeção visual do META mostra excesso de molduras, texto compacto e controles herdados de 34 px. O novo painel usa corpo de 16 px e alvos de 44 px; a cascata antiga ainda precisa de refatoração gradual.
5. **P1 — Consistência de fontes.** `officialStatus` recebe status de cobertura, e `eventType` também mistura conceitos no payload legado. A próxima migração deve distinguir organização oficial, cobertura e categoria do evento sem quebrar as URLs.
6. **P1 — Taxonomia.** Formatos são em parte inferidos por datas e versões de coleção. Há registros históricos cuja combinação data/formato merece revisão; não corrigir ano automaticamente sem fonte. Regiões JP/EN/CN e formatos digitais precisam de campos próprios.
7. **P2 — Desempenho.** O build observado produziu CSS principal de cerca de 811 kB (128 kB gzip); o payload completo local estava em aproximadamente 18 MB. Rotas são lazy, mas páginas simples ainda podem puxar o payload completo. Não é uma medição de Core Web Vitals: RUM/LCP/INP/CLS exigem instrumentação e uso real.
8. **P2 — Idioma e semântica.** Mistura de português/inglês e tradução por observação do DOM dificultam consistência. Novos componentes usam a localidade React explicitamente. Migrar textos antigos por jornada e preferir links de navegação reais, títulos semânticos e foco previsível.
9. **P2 — Identidades e rankings.** Agregar apenas pelo apelido pode unir pessoas diferentes. Não promover essa agregação a ranking oficial; migrar para identificadores da fonte e vinculação voluntária.

## Plano em seis fases

| Fase | Entrega / critério de aceite | Situação |
| --- | --- | --- |
| 1. Discovery | Auditoria de rotas, referências, contratos e limites de fontes. Separar observação de hipótese. | Primeira rodada concluída; benchmark visual detalhado do TDGR pendente. |
| 2. Experiência | Cartas, Decks, Meta, Comunidade como nomes claros; trajetos carta → lista → evento; fonte/período persistentes; regiões explícitas. | Plano definido; manter aliases e navegação existente na migração. |
| 3. Fundações | Consolidar tokens e componentes; reduzir camadas CSS e `!important` por superfície; 320–430 px, teclado, redução de movimento. | Padrão novo aplicado ao painel e formulário; consolidação global ainda proposta. |
| 4. Jornadas | Catálogo: busca e drawer; Forge: adicionar, validar, salvar, comparar versões; decks: voltar ao filtro; eventos: cobertura antes de interpretação. | Melhorias de META/eventos implementadas; demais jornadas preservadas. |
| 5. Funções | Fontes oficiais por região, API Limitless para confrontos, integração MSA quando comprovada, revisão de contribuições, páginas de loja e guias contextuais. | Formulário/importador e motor de partidas implementados; feeds completos e revisão web pendentes. |
| 6. QA | Testes de contratos e cálculos, falhas de fonte sem apagar dados, fluxo de contribuição, breakpoints e regressão de URLs. | 170 testes passaram e build local passou; verificação browser registrada abaixo. |

Direção visual: manter o azul profundo, acentos técnicos e identidade TCGTD; priorizar tipografia legível, superfícies estáveis e hierarquia. A arte mecha pode contextualizar a marca, mas não deve competir com tabelas, inputs ou contagens. Nenhum layout concorrente foi copiado.

## Estrutura de dados para a próxima integração

O pipeline deve manter três conjuntos separados: **catálogo/regras oficiais**, **eventos/resultados/listas**, **partidas digitais ou de torneios**. Cada registro deve guardar ID da fonte, URL, data do fato, instante da consulta, região, idioma/formato, versão do adaptador e hash do conteúdo. `official`, `complete` e `reviewed` respondem a perguntas diferentes e não devem ocupar o mesmo campo.

Para Bandai, a ordem proposta é: índice oficial de eventos → relatório oficial → lista vinculada → revisão de mudanças de formato. A existência do evento pode ser publicada antes dos resultados, com estado explícito de cobertura. Textos de cartas, variantes e legalidade continuam ancorados no identificador oficial; aliases de arquétipo preservam a nomenclatura original. Para grandes eventos, armazenar etapas, sessões e categoria de competição para não juntar dois torneios chamados “Shop Battle” no mesmo dia. Organizadores, cidade ou ID oficial devem desambiguar esses casos; quando ausentes, encaminhar à revisão.

Para Limitless, o adaptador proposto consome detalhes, standings e pareamentos, com cache por evento e comparação de hash. Liga os participantes por ID dentro do evento, preserva o nome original do deck e registra a versão da taxonomia. Byes, empates, derrotas duplas, partidas pendentes e fases eliminatórias precisam de estados próprios. Não converter registros de classificação como `record.wins` em uma lista inventada de partidas. O teste da API confirmou a viabilidade dos pareamentos; **esse adaptador de partidas ainda não foi implementado**.

Para MSA, o incremento implementado coleta somente o resumo público. As páginas de resultado são a próxima verificação útil quando o transporte funcionar. Se expuserem legitimamente decks e data, o adaptador poderá normalizar esses campos; se não, será necessário um feed disponibilizado pelo operador ou exportação autorizada. Não utilizar o endpoint autenticado do histórico como se fosse uma API pública. A amostra de 12 partidas não cobre uma temporada.

Para ExBurst, Egman e TCG Top Decks HQ, priorizar identificadores/listas compartilháveis e links para a fonte. Uma URL de deck pode ser útil ao jogador mesmo quando as cartas ainda não foram importadas: por isso o sistema separa resultado indexado, link externo e lista com cartas. Não promover automaticamente uma lista comunitária a resultado de torneio.

## Mecânica analítica implementada e dependências

`src/domain/battleAnalytics.js` implementa participação por aparições dos dois lados, taxa observada `vitórias / (vitórias + derrotas)`, empates explícitos, intervalo de Wilson 95%, corte mínimo de partidas decisivas, exclusão de mirrors, recorte por fonte/temporada/datas, confrontos e série diária. O padrão é 30 partidas decisivas; é um controle de apresentação, não garantia de representatividade. Ranking usa o limite inferior do intervalo separadamente da taxa bruta. Repetições idênticas contam uma vez e IDs com resultados divergentes ficam fora do cálculo.

Partidas sem data ou arquétipo de qualquer lado não entram no cálculo. Modo casual não é misturado ao Ranked. As datas do recorte são dias UTC; uma interface de filtros futura deve comunicar esse fuso. Testes usam dados sintéticos identificados como fixtures; a interface pública só usa o snapshot real e mostra **zero partidas elegíveis**. Não há gráficos de matchup completos nem histórico de MSA prometidos como entregues.

O painel de torneios já entregue mostra participação nos resultados indexados, listas realmente acompanhadas de cartas, eventos e arquétipos desconhecidos, além do filtro por fonte. Esse filtro se aplica ao próprio painel; os módulos legados abaixo continuam seguindo o seletor global de período. Percentual de tops não mede popularidade em todo o campo. Conversão para Top Cut requer o campo completo e o corte real. Quando falta período anterior com listas, movimentos ficam indisponíveis em vez de parecerem crescimento ou estabilidade medida.

## Comunidade: operação local disponível

A rota `/community/contribute` permite que a loja informe evento, data, organizador, local opcional, número de participantes, fonte pública e resultados com links de deck opcionais. O formulário valida os campos, exige confirmação sobre publicação dos resultados, mostra revisão e baixa JSON. Alterações posteriores invalidam a revisão. O arquivo deve ser encaminhado pelo canal já utilizado entre a loja e a equipe; **ainda não existe caixa de entrada web, envio automático ou publicação automática**.

O importador valida novamente, ignora campos de confiança enviados pelo usuário e mantém a fonte como comunitária. A aceitação local não torna o evento oficial. Arquivo já aceito não é sobrescrito silenciosamente. Antes de aceitar, o operador verifica a fonte, agrupamentos existentes e possíveis correções; a prevenção por ID não substitui essa revisão entre fontes.

Comandos, contrato e cuidados de operação: [Guia de ingestão](./MSA-AND-COMMUNITY-INGESTION.md). O teste de ida e volta confirmou que uma contribuição validada chega aos resultados e eventos normalizados sem criar cartas ou listas inexistentes. Nenhuma contribuição fictícia foi aceita na base real.

## Verificação local e limites da entrega

- **170 testes automatizados aprovados**, incluindo contratos de contribuição, round trip até a projeção de frontend, falhas/esquema MSA, cálculos, períodos inválidos, duplicatas e campeões ambíguos. A suíte também cobre regras, importação/exportação e funcionalidades existentes.
- **Build React/Vite aprovado**, sem erro de compilação. Os 14 arquivos de imagens de temas citados pelos avisos de resolução foram encontrados no artefato final. CSS principal ainda tem 810,88 kB (127,80 kB gzip). A rota de contribuição foi incluída no carregamento leve e não exige o payload competitivo completo.
- **Validação da base:** zero erros bloqueantes e 362 avisos `duplicate_placement`; os avisos precisam de revisão editorial. No histórico observado: 1.328 resultados, 1.310 ocorrências de listas com cartas, 280 eventos com resultados e 83 agrupamentos com primeiros lugares conflitantes. O índice inclui 281 eventos, pois um deles não possui resultados. Esses números descrevem o snapshot local, não o universo do jogo.
- **Navegador:** painel META e formulário verificados em 320, 375, 430, 768 e 1280 px, sem overflow horizontal do documento nas medições; campos de 44 px e corpo de 16 px nos componentes novos. Fluxo exercitado: preenchimento → revisão → download → edição invalida revisão; jogador duplicado bloqueado, com erro em português e foco no resumo. Filtros de período histórico e fonte Egman atualizaram as contagens. O evento real `0233eea3d7cfa50d` exibiu o estado de primeiros lugares conflitantes.
- **Escopo pendente:** refatoração global de CSS/design system, UX completa de catálogo/Forge, novos feeds oficiais, painel de matchups com dados elegíveis, revisão web de lojas, benchmark detalhado do TDGR, auditoria WCAG completa, fluxos autenticados no navegador e Core Web Vitals em uso real. Esta entrega não encerra a transformação inteira do produto.

Durante a sessão apareceram também atualizações nos conjuntos históricos e assets locais fora dos arquivos de implementação desta etapa. Foram preservadas. A publicação deve partir do artefato local revisado e validado, após a confirmação exigida pelo `AGENTS.md`; não foi executado deploy nem alteração no live.

Foi gerada uma [fila inicial de 83 agrupamentos para revisão](./competitive-event-review-2026-09.json), com IDs, fontes e registros de primeiro lugar. Ela é um instrumento de auditoria: nenhum evento foi separado, apagado ou corrigido automaticamente a partir dessa lista.
