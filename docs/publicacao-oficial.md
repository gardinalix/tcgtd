# Publicação pelo Atualizador Oficial do Site

Referência compartilhada entre os chats do TCG Tactical Database, definida pelo usuário em 06/11/2026. Leia também o AGENTS.md atual do checkout. Fixar um chat na interface facilita o acesso, mas não substitui estas instruções.

- Chat: [Atualizador Oficial do Site](https://chatgpt.com/local/01a13f42-0ed0-7244-b9ae-30ce60f2f020), anteriormente Atualizar pool de cartas.
- ID estável: `01a13f42-0ed0-7244-b9ae-30ce60f2f020`.
- Projeto Sites: `appgprj_6a68269688848191accea7675bbb56b3`.
- Produção: https://tcgtd.com.br.
- Qualquer modelo disponível pode preparar, publicar e verificar; não há requisito de modelo ou esforço específico.
- Fonte canônica: https://github.com/gardinalix/tcgtd.git; `sites-source` é referência de hospedagem, não base de desenvolvimento.

## Preparar no chat de origem

1. Leia o estado atual do Git, preserve alterações de outras tarefas e confira se há refresh em andamento. Não empacote arquivos que ainda estão sendo escritos.
2. Valide a versão local: testes, build, dados, migração SQLite local, artefatos de hospedagem e funcionalidades afetadas. Registre falhas conhecidas sem ocultá-las.
3. Identifique precisamente a versão por commit e hashes. A autorização permanente registrada em AGENTS.md cobre as versões do site e dos dados que passarem na validação local, inclusive no refresh agendado.
4. Prepare pacote imutável com fonte recuperável (commit acessível ou bundle Git com base documentada), dist completo, manifesto SHA256, evidências e limitações. Não inclua segredos. Confira que fonte, dados e build pertencem à mesma versão.
5. Para a transferência que já funcionou neste chat, divida pacotes grandes em anexos ZIP individuais menores que 32 MiB. Cada ZIP contém uma parte numerada do ZIP original. Informe quantidade, ordem, tamanho e SHA256 final: extrair os membros e concatená-los, nunca concatenar os ZIPs externos.

## Publicar no chat oficial

1. Abra o link acima pelo navegador autenticado e leia a resposta mais recente antes de enviar qualquer solicitação. Se houver publicação em andamento, acompanhe-a. Se o SHA já foi publicado, recupere seu resultado sem repetir o deploy.
2. Confira o modelo selecionado e registre-o no resultado. Qualquer modelo disponível é aceito.
3. Encaminhe o pacote validado, o projeto, o domínio, o SHA fonte, os hashes, as validações e as ressalvas. Peça publicação direta e verificação do live. Forneça anexos ou uma fonte acessível ao publicador.
4. Use exatamente o build validado, sem novo refresh, META ou regeneração. Preserve audiência, domínios, D1, segredos e configurações. Alterações exclusivas de produção precisam de autorização específica. Não faça push no GitHub main apenas como efeito incidental do deploy.
5. Aguarde conclusão e confira o resultado. Em caso de limite de uso ou interrupção, retome na mesma conversa quando possível, conferindo antes o estado e a integridade do pacote. Não crie outra publicação para contornar a interrupção.
6. Registre a publicação e a verificação com URL, versão, deployment ID, SHA, rotas, downloads reais, capturas e pendências. HTTP 200 sozinho não comprova que uma página funciona. Registre falhas e valide qualquer versão corrigida antes de publicar.

## Continuidade entre chats

Todo chat que trabalhar neste checkout deve consultar AGENTS.md. Inclua este arquivo e o AGENTS.md atual nos pacotes enviados ao publicador. Checkouts remotos só recebem mudanças de instruções quando forem sincronizados ou quando elas forem fornecidas explicitamente; fixar um chat não sincroniza instruções por si só.

Em 06/11/2026, o chat oficial era visível no navegador, mas não constava na listagem de chats Codex locais. Os menus dessa conversa antiga não ofereciam Fixar, e o gerenciador retornou que não encontrou seu ID. Use o link estável; não renomeie outro chat nem crie um substituto para simular a fixação.

## Última publicação observada (referência histórica)

Lida na resposta final do publicador em 06/11/2026 às 12:17 BRT; este registro não substitui consultar o estado atual antes da próxima publicação.

- Versão: **126**.
- Deployment: `appgdep_6aedeee971f08191bbeb3c6e6cfd9bd4`.
- Fonte: `8a940ddb8cb8aba6cf842ad6d92fa557c9e201d7`.
- Relato do publicador: pacote aprovado publicado sem rebuild/refresh; nove rotas, sete temas e 290 hashes conferidos; XLSX com 2.087 edições / 1.195 cartas, 21 colunas e IDs únicos; exports TXT/PNG funcionando.
- Pendências relatadas: `/card/GD06-001_p1` apresenta Card not found (variante funciona dentro de `/cards`); textos desalinhados no diálogo XLSX.
- Dados gerados depois desse snapshot não fazem parte dessa publicação.
