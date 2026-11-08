# Publicação do TCG Tactical Database

Qualquer chat do projeto com acesso funcional ao Sites pode executar o mesmo fluxo nativo usado pelo Atualizador Oficial. Consulte também o AGENTS.md e a skill Sites instalada.

- Projeto existente em `.openai/hosting.json` — `appgprj_6a68269688848191accea7675bbb56b3`.
- Produção — [tcgtd.com.br](https://tcgtd.com.br).
- Fonte de desenvolvimento — `origin/main` do [GitHub canônico](https://github.com/gardinalix/tcgtd). Use o remoto do Sites para ler a fonte de uma versão hospedada e sincronizar o deploy.
- Alternativa para chats sem acesso ao conector — [Atualizador Oficial do Site](https://chatgpt.com/local/01a13f42-0ed0-7244-b9ae-30ce60f2f020).

## Preparar e validar

1. Confira o Git, o refresh em andamento e o estado do Sites antes de montar o build. Preserve o trabalho em curso. Identifique a versão efetivamente publicada, seu SHA e as versões salvas mais recentes. Um save pode existir sem deploy.
2. Compare a fonte publicada com o checkout. Se a hospedagem tiver correções ausentes no GitHub ou na branch local, recupere o SHA exato ou o pacote de fonte da publicação, incorpore as correções sem perder o trabalho local e valide o resultado. Em particular, a v129 adicionou a rota `/previews` e corrigiu o diálogo XLSX. Na data do registro, `7661a48` não existia no checkout canônico local. Um refresh de dados também precisa preservar essas correções.
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

O Atualizador Oficial confirmou em 08/11/2026 a versão **129**, fonte `7661a48` e deployment `appgdep_6af0a68f14408191bdb391d94f75a702`. O relatório registra `/previews` funcionando, diálogo XLSX alinhado em desktop e celular, 185 testes aprovados e os dois downloads validados. Consulte o Sites antes da próxima publicação.
