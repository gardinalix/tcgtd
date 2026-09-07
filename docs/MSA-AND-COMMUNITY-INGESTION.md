# MSA e contribuições de lojas — operação local

## Atualizar o resumo público do MSA

```powershell
npm run data:msa
```

Consulta somente `https://mobilesuitarena.com/` e grava `web/data/competitive/msa-public.json` após validar o snapshot. Falha de rede, esquema incompatível, IDs repetidos ou resumo vazio encerram a operação sem substituir o snapshot válido anterior. Não há agendamento ativado. Não captura sessão, apelidos, ranking ou mensagens.

Para reproduzir uma coleta pública arquivada:

```powershell
npm run data:msa -- --from-html .scratch/msa-public.html
```

Nesse modo, o instante de modificação do HTML é usado como observação; preserve o timestamp do arquivo original. Nunca tratá-lo como data da partida. O snapshot atual é parcial: possui vencedor e modo, mas não datas/decks suficientes para meta por arquétipo. O build normal não faz uma nova consulta ao MSA.

## Receber resultados de uma loja

1. A loja preenche `/community/contribute`, revisa e baixa o JSON.
2. A loja encaminha o arquivo à equipe pelo canal já utilizado entre as partes.
3. O operador valida o arquivo localmente, confere a fonte e procura o mesmo evento na base.

```powershell
npm run data:community -- caminho/do/arquivo.json
```

Esse comando apenas apresenta o evento, a quantidade de resultados e o ID proposto. Não grava dados. O formato aceito é `tcgtd-community-event-v1`; datas futuras/impossíveis, URLs com credenciais, protocolo inadequado, resultados duplicados por apelido, colocações incompatíveis e ausência de confirmação são rejeitados. Máximo de 1 MB e 256 resultados por contribuição.

Após a revisão do conteúdo, aceitar no conjunto de fontes **local**:

```powershell
npm run data:community -- caminho/do/arquivo.json --accept
```

Grava um arquivo em `data/competitive/sources/community-events/` com o instante de revisão. O mesmo ID não é sobrescrito. Uma correção requer editar o arquivo existente conscientemente, preservando a revisão e histórico de Git. Não renomear aleatoriamente arquivos para contornar duplicatas.

## Materializar e conferir antes de publicar

```powershell
npm run data:migrate
npm run data:validate
npm run data:build
python scripts/build_gundam_web_data.py
npm test
npm run build
```

`data:migrate` reprocessa o conjunto legado, registro manual e contribuições aceitas. É diferente de `data:build`, que deriva arquivos do conjunto normalizado existente. O passo Python atualiza o payload de compatibilidade usado pelas páginas; não omitir após uma importação. O build final gera os payloads públicos e o frontend.

Conferir o diff, o evento, resultados, fonte, avisos de validação e `/meta` na prévia. Um link de deck permanece externo até que suas cartas tenham sido importadas por um adaptador apropriado. Este fluxo não faz download das URLs fornecidas no formulário.

Nenhum comando acima publica o site. A publicação exige a confirmação separada definida no `AGENTS.md` e deve usar a versão validada. Não executar coleta/migração adicional entre a aprovação e o deploy sem validar novamente a versão resultante.

## Evoluções previstas

A caixa de entrada de contribuições pode usar a infraestrutura autenticada existente: submissão → fila de revisão → aceite ou solicitação de correção → publicação. Separar papéis de loja e moderador, armazenar auditoria e manter limites por arquivo/evento. Essa etapa não foi implementada; o JSON já estabelece o contrato para evoluir sem refazer o formulário.

O coletor completo de partidas Limitless e o enriquecimento MSA dependem de adaptadores distintos. Manter feeds digitais e torneios separados, com ID da fonte e definição de cobertura. O relatório de produto registra as fontes verificadas e os critérios para habilitar gráficos reais.
