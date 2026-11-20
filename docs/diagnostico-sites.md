# Diagnóstico de acesso ao Sites

Este procedimento evita declarar o conector indisponível sem testar o acesso oferecido pela sessão. Aplica-se a qualquer modelo e cliente. Não publica versões, não modifica acesso e não altera o ambiente live.

## Descobrir antes de concluir

1. Identifique o projeto solicitado. Para Gundam, use `appgprj_6a68269688848191accea7675bbb56b3`; não consulte ou modifique Cyberpunk por engano.
2. Leia a skill Sites disponível na sessão. Os aliases e nomes das ferramentas podem mudar entre clientes; reutilizar um nome de outro chat não comprova a existência da ferramenta atual.
3. Examine as ferramentas nativas e os namespaces diferidos. Use a busca de ferramentas do cliente, se disponível. Quando `functions.exec` expuser `ALL_TOOLS` e `tools`, procure os nomes/descritivos do Sites nesse catálogo e chame o método real retornado em `tools`. O catálogo visível inicialmente pode não conter todas as ferramentas diferidas.
4. Se não houver mecanismo de descoberta ou ferramenta Sites exposta, registre exatamente isso. Não invente uma API, não tente invocar MCP pelo shell e não declare que o servidor Sites está fora do ar.

Exemplo de descoberta apenas nos clientes que oferecem `ALL_TOOLS`:

```js
text(ALL_TOOLS
  .filter(t => /sites.*(get_site|list_site_versions|get_deployment_status)$/.test(t.name))
  .map(t => ({name: t.name, description: t.description})));
```

Esse trecho é para o avaliador `functions.exec`, não para Node, PowerShell ou o console de uma página. Em outro cliente, use seu mecanismo nativo equivalente.

## Comprovar o acesso com leituras

1. Chame `get_site` com o projeto exato. Leia os dados estruturados e também a indicação `isError`, quando existente: completar o transporte da chamada não garante sucesso da operação.
2. Chame `list_site_versions`. Retenha somente IDs, números de versão, SHA da fonte e IDs de deployment pertinentes.
3. Se a versão relevante tiver deployment ID e for necessário determinar seu estado, chame `get_deployment_status` usando esse ID. Uma versão salva não prova que ela foi publicada.
4. Registre apenas os campos necessários. `get_site` pode retornar token de bypass e credenciais; nunca imprima nem anexe a resposta bruta. O relatório não precisa de e-mails, tokens, URLs assinadas ou variáveis live.
5. Não emita credenciais Git, não faça save/deploy e não altere permissões para testar a disponibilidade. Esses passos pertencem a uma publicação concreta autorizada.

Se as leituras funcionarem, a conclusão é **acesso de leitura ao Sites confirmado nesta sessão**. Acesso de escrita e capacidade de empacotar continuam não testados. Se uma etapa posterior falhar, registre a etapa exata em vez de reclassificar retroativamente todas as ferramentas como indisponíveis.

## Classificar e corrigir o bloqueio

| Evidência observada | Classificação e próximo passo |
| --- | --- |
| Nenhuma ferramenta Sites após a descoberta suportada | Ferramentas não expostas neste cliente/chat. Registrar o que foi pesquisado e encaminhar o diagnóstico para conferir a conexão nessa sessão. |
| Ferramenta encontrada, mas chamada com nome ou argumentos inválidos | Erro de invocação. Ler a assinatura atual, corrigir os argumentos/roteamento e repetir a consulta afetada. |
| Mensagem pede outro mecanismo para invocar a ferramenta | Erro de roteamento do cliente. Usar o mecanismo indicado se disponível; não substituir por um endpoint inventado. |
| Serviço retorna acesso negado, autenticação expirada ou aprovação negada | Registrar o código e a mensagem sem segredos; resolver a autorização/conexão aplicável. Não alterar audiência para contornar o erro. |
| Serviço retorna limite de uso, timeout ou falha interna | Registrar horário, operação e erro. Respeitar orientações de retry. Antes de repetir save/deploy, consultar versões e deployments para evitar duplicação. |
| Leituras funcionam, mas `site-workflow.mjs` não foi localizado | Helper/instalação local ausente. O conector de leitura funciona. Seguir o fluxo suportado da skill ou registrar a falta do helper; não reconstruir um pacote congelado para contornar isso. |
| Caminho `C:`/`E:` não existe na nuvem, ou pacote não foi transferido | Arquivo inacessível nesse ambiente. Preservar o pacote aprovado e transferi-lo; isso não é uma falha do Sites. |
| Navegador ou teste de interface falha após deploy confirmado | Falha de verificação ou da aplicação. Separar o resultado do deploy do resultado funcional e investigar o erro específico. |

Não reinicie, reinstale ou troque o modelo como tentativa genérica. Repita uma operação depois de corrigir sua causa identificada ou quando o serviço indicar uma tentativa posterior. Não conclua que o modelo causou um erro do backend só porque houve troca de modelo entre chats.

## Evidência mínima entre chats/modelos

Use o mesmo projeto e as mesmas consultas de leitura em cada sessão investigada. Registre:

- Data/hora com fuso, cliente, sistema/ambiente e identidade de modelo realmente disponível.
- Métodos de descoberta usados e nomes exatos das ferramentas encontradas.
- Para cada chamada: operação, argumentos não sensíveis, sucesso/erro, código e mensagem sanitizada, ou motivo pelo qual não foi possível invocá-la.
- Versão, SHA, deployment ID e estado observados quando acessíveis.
- Etapas não testadas e arquivos locais ausentes, separadamente.

Não registre o texto do raciocínio interno do modelo. Os nomes das ferramentas, argumentos não sensíveis e resultados observáveis bastam. Se o chat apenas escreveu “conector indisponível”, a causa permanece **não determinada** até esse diagnóstico.

## Prompt para o chat que relatou indisponibilidade

> Diagnostique o acesso ao Sites sem publicar nada. Descubra as ferramentas e namespaces diferidos disponíveis neste cliente, usando a busca de ferramentas se existir. Para o Gundam `appgprj_6a68269688848191accea7675bbb56b3`, tente `get_site` e `list_site_versions` quando encontrados; consulte o deployment relevante somente com um ID retornado. Informe nomes reais das ferramentas, resultados, códigos/mensagens de erro sanitizados e etapas não testadas. Não copie respostas brutas com tokens, não emita credenciais e não altere permissões, DNS ou produção. Se as ferramentas não estiverem expostas após a descoberta, diga isso especificamente. Ausência de helper, arquivo local ou entrada inicial no catálogo não comprova que o conector está fora do ar. Informe também o cliente e a identidade de modelo efetivamente exposta, sem adivinhar a variante.
