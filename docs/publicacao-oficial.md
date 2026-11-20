# Publicação do TCG Tactical Database

Qualquer chat do projeto com acesso funcional ao Sites pode executar o mesmo fluxo nativo usado pelo Atualizador Oficial. Consulte também o AGENTS.md e a skill Sites instalada.

- Projeto existente em `.openai/hosting.json` — `appgprj_6a68269688848191accea7675bbb56b3`.
- Produção — [tcgtd.com.br](https://tcgtd.com.br).
- Fonte de desenvolvimento — `origin/main` do [GitHub canônico](https://github.com/gardinalix/tcgtd). Use o remoto do Sites para ler a fonte de uma versão hospedada e sincronizar o deploy.
- Alternativa para chats sem acesso ao conector — [Atualizador Oficial do Site](https://chatgpt.com/local/01a13f42-0ed0-7244-b9ae-30ce60f2f020).

## Preparar e validar

1. Confira o Git, o refresh em andamento e o estado do Sites antes de montar o build. Preserve o trabalho em curso. Identifique a versão efetivamente publicada, seu SHA e as versões salvas mais recentes. Um save pode existir sem deploy.
2. Compare a fonte publicada com o checkout. Se a hospedagem tiver correções ausentes no GitHub ou na branch local, recupere o SHA exato ou o pacote de fonte da publicação, incorpore as correções sem perder o trabalho local e valide o resultado. As correções de `/previews` e do diálogo XLSX da v129 foram incorporadas com o patch de `7661a48` no commit `c863179`.
3. Valide o código, os dados, as rotas afetadas, o build e, quando aplicável, a migração SQLite em memória, o Worker e os artefatos Sites. Congele o commit completo, o `dist` e o manifesto SHA256. Confira a correspondência entre fonte, dados e build. A autorização permanente cobre as atualizações validadas do site e dos dados gerados. Pedidos expressos de prévia ou trabalho apenas local terminam nessa etapa.

## Publicar diretamente no chat de origem

1. Descubra as ferramentas do conector Sites. Consulte `get_site`, `list_site_versions` e, quando houver um deployment ID, `get_deployment_status`. Confirme projeto, audiência e estado real antes de qualquer escrita. A presença da ferramenta no catálogo só conta como acesso quando a chamada funciona. Se já houver deploy do SHA em andamento, acompanhe-o. Se o SHA estiver publicado, verifique o live. Se houver versão salva do mesmo SHA com o arquivo correspondente, use seu ID.
2. Para um SHA novo, chame `create_source_repository_write_credential` para o projeto existente. Use a URL, branch e modo de autenticação retornados. Siga o helper de fonte da skill Sites (`site-workflow.mjs`), com a credencial apenas em memória e por stdin. Em `work_proxy`, use a autenticação fornecida pelo ambiente. Prepare em um checkout isolado quando necessário para preservar a branch de trabalho. Envie o SHA completo validado somente à branch de hospedagem e confira que o HEAD remoto é esse SHA. Se a branch avançar, reconcilie antes de prosseguir.
3. Empacote o build já validado com o helper do Sites (`package-site.mjs`, também chamado pelo `site-workflow.mjs`). O arquivo de deploy é um TAR com o build, o manifesto de hospedagem e as migrações do artefato. O ZIP de transferência com `source.bundle` e evidências é outro arquivo. Se usar o helper com um build já validado, passe `commands: []` e um `archivePath` absoluto fora do checkout. Confira o SHA e a integridade do artefato devolvido antes de salvá-lo.
4. Chame `save_site_version` com `project_id`, `commit_sha` completo e o caminho absoluto do TAR em `archive`. Use o ID opaco retornado como `version_id` em `deploy_site_version` para o site público. Preserve a audiência, domínios, D1, segredos, variáveis e demais configurações. A publicação do build não inclui migração de dados live nem push no GitHub main.
5. Consulte `get_deployment_status` com o deployment ID até um estado terminal. Em interrupções, consulte os IDs existentes antes de qualquer tentativa nova. Após o sucesso, verifique o domínio, o conteúdo real das rotas afetadas, os hashes dos dados e os downloads pertinentes. Registre versão, SHA, deployment ID, resultado dos testes e limitações. Se o deploy falhar, preserve a última versão funcional e registre a etapa que falhou.

## Encaminhar quando o conector estiver indisponível

1. Abra o Atualizador Oficial pelo navegador autenticado e consulte o último resultado para evitar duplicação. Reuse o chat existente. Se o ambiente também não der acesso a ele, preserve o pacote e informe o bloqueio.
2. Encaminhe o projeto, domínio, SHA completo, modelo usado, hashes, evidências e ressalvas. Inclua uma fonte recuperável e o `dist` exato. Quando o publicador não puder acessar o checkout local, transfira um ZIP com `source.bundle`, commit base, manifesto SHA256, build, AGENTS.md e este procedimento.
3. Para arquivos grandes, divida o ZIP em anexos individuais de até 30 MiB de conteúdo. Cada ZIP externo contém um membro numerado. Informe tamanho total, SHA256, número e ordem das partes. Extraia os membros e concatene-os, confira CRC e hashes e publique o build original. Acompanhe e registre o resultado pelo mesmo fluxo acima.

## Última publicação observada

- Versão **135**, fonte `eddcb1f54d2c75e8118d8ba66c8eab8bf1d07682`, versão salva `appgprj_6a68269688848191accea7675bbb56b3~appgver_6dbb3fa4aad081918c5e3174926b620f`, deployment `appgdep_6b00a555faac81918db22cfb50e24a7a`. Publicada diretamente pelo conector Sites. Modelo Codex baseado em GPT-6, variante exata não identificada.
- **Publicação:** concluída. Tema opcional GFreD / Alphaciders com paleta violeta, arte da unidade, cockpit próprio e seleção persistente. Passou em 192 testes Node, build e migração SQLite em memória. Os 2.635 arquivos do build congelado conferiram com o TAR antes do envio. Fonte sincronizada no GitHub `main` e na branch de hospedagem.
- **Verificação live:** cockpit e seletor conferidos no domínio; preferência GFreD preservada ao navegar para `/cards` e voltar. `/`, `/cards`, `/previews` e `/settings` responderam como navegação HTML com o bundle validado. Os hashes dos dados JSON públicos, do JavaScript, do CSS e das três imagens/emblema do tema conferiram com o build. Desktop de 1440 px e celular de 390 px foram verificados localmente.
- Evidências em `.local/tcgtd-release-eddcb1f`; TAR preservado em `E:/Codex/tcgtd-releases/archive-gfred-eddcb1f.tar` (gzip, SHA256 `903b9017b4a526becde5b95bffdf7d94fba9de95b0ed238992b35447e2138741`). O Sites reempacotou o arquivo recebido em TAR, com hash `d921ffbbdc7a170a3eab7ef1bfb24688d31d996e9a4f75be9a35be8ffc0a4235` e os mesmos 2.636 arquivos do artefato. A correspondência do conteúdo foi verificada nos arquivos publicados. Pendências desta mudança: **nenhuma**.

## Publicações anteriores

- Versão **134**, fonte `a5aa94e2be7dcb7864890548fb3457a899220485`, versão salva `appgprj_6a68269688848191accea7675bbb56b3~appgver_0cb7dcc42144819192a6c4a0a23a4106`, deployment `appgdep_6b0045966308819199bc835d4b4c67ac`. Publicada diretamente pelo conector Sites neste chat. Modelo Codex baseado em GPT-6, variante exata não identificada.
- **Publicação:** concluída. O pacote contém o SHA validado, reconcilia a v133 e passou por 192 testes Node, 25 testes Python, build e migração SQLite em memória. Os 2.632 arquivos do build congelado conferiram com o TAR antes do envio.
- **Verificação live:** os quatro JSONs públicos conferiram por SHA256; `/cards`, `/previews`, `/prices` e o evento de 19/11 responderam com o bundle validado. No navegador, `GD 07` retornou 23 revelações e `EB02` retornou Destiny Gundam com fonte. Os três preços de Infinite Justice Gundam conferiram nas respectivas impressões. A busca também passou na prévia móvel de 390 px.
- **LigaGundam:** bloqueio do transporte HTTP identificado e tratado, sem renovar datas do cache. Três anúncios foram conferidos pelo navegador e importados; 1.579 mantêm as datas anteriores. A coleta automática completa continua dependente do acesso permitido pela fonte. Diagnóstico em `docs/diagnostico-ligagundam.md`; evidências em `.local/tcgtd-release-a5aa94e`; TAR preservado em `E:/Codex/tcgtd-releases/archive-liga-a5aa94e.tar`.

- Versão **133**, fonte `891eaa95d6f7b07a3a4d0cfd5d701aa869739ca8`, deployment `appgdep_6b0040b206948191a0d76a05ea802aab`. Publicada diretamente pelo conector Sites neste chat. Modelo Codex baseado em GPT-6, variante exata não identificada.
- Refresh de 20/11 validado com 188 testes Node, build, migração SQLite em memória, integridade do banco e dos XLSX e validação do TAR. O reinício do aplicativo interrompeu a primeira execução após cartas e preços. A retomada reutilizou essas etapas concluídas e executou META, relatórios, workbooks e build.
- No domínio, os quatro JSONs públicos conferiram por SHA256 com o pacote. As rotas `/cards`, `/previews` e `/community/events/cd5b3a1bb3d33c25` responderam com o bundle validado. O Eagle’s Nest de 19/11 está disponível, e o catálogo conserva as 1.195 cartas canônicas e todos os torneios anteriormente publicados.
- LigaGundam continua bloqueando o coletor com um desafio Cloudflare. Os preços de 13/11 foram mantidos com suas datas originais. TCGCSV e USD/BRL foram atualizados em 20/11. Evidências e TAR em `.local/tcgtd-release-891eaa9`.

- Versão **132**, fonte `6fce667f5fb11e28a122f84869e378e3aa3364fb`, deployment `appgdep_6afafc3b2d348191a4eafdd5f4079b4a`. Publicada pelo Atualizador Oficial do Site. Modelo exibido no publicador GPT-6 Astra High.
- O TAR validado passou por 188 testes Node, 19 testes Python, build e migração SQLite em memória. Conferimos em produção os hashes dos três JSONs públicos e as rotas `/cards`, `/previews` e `/community/events/47e92c95dde0aa2f` do Eagle’s Nest de 12/11.
- ST12 e ST13 estão no catálogo. PB04 está nos dados publicados e o filtro de `/previews` exclui o prefixo PB. Os preços da LigaGundam continuam com data de 13/11 após o bloqueio da coleta.

- Versão **131**, fonte `a398dafe446bec974ff2b5768b26a5c11ecacbb2`, deployment `appgdep_6af737a4b568819197e5d54eec16934e`. Publicada pelo Atualizador Oficial do Site com Codex baseado em GPT-6, sem variante identificada na sessão.
- O build passou nos 188 testes Node, na migração SQLite em memória e na validação do artefato Sites. Em produção, `/cards` retornou os mesmos 184 resultados para `GD 06` e `GD06` e duas impressões de ZZ Gundam para `GD 06-033`. Pendências desta publicação: **nenhuma**.

- Versão **130**, fonte `8a10ffc68c311fec4d5489da6160b0bdd48fba40`, deployment `appgdep_6af0ccbd44b88191a175e2ee075e170b`.
- Em produção, os dois XLSX foram baixados e validados: 2.087 edições e 1.195 cartas canônicas, 20 colunas e oito regras de cor na coluna E. A rota `/previews` e o diálogo XLSX em desktop e celular foram verificados. Os hashes dos dados públicos e do bundle de Cartas conferem com o pacote.
- Pendências desta publicação: **nenhuma**. A v130 preserva as duas correções de interface da v129 e entrega a formatação por cor.
