# Repositório canônico e continuidade

Estas orientações valem para todos os chats do TCG Tactical Database, inclusive os vinculados ao projeto Sites `appgprj_6a68269688848191accea7675bbb56b3`.

- O repositório principal é `https://github.com/gardinalix/tcgtd.git`, com `main` como branch padrão e `origin` apontando para o GitHub.
- O remoto antigo do Sites permanece como `sites-source`, apenas para referência da hospedagem. Não o use como fonte principal para continuar o desenvolvimento.
- O checkout local canônico é `E:\Codex\2026-04-19-we-need-to-create-a-full`.
- Chats na nuvem devem usar seu próprio checkout autorizado do repositório GitHub; o caminho local no disco `E:` não é um requisito nesses ambientes.
- Referência histórica da migração em **2026-10-11**: commit `21a25db`. Ao retomar o trabalho, use o estado atual de `origin/main`, em vez de restaurar esse checkpoint ou uma cópia antiga do Sites.
- Antes de sincronizar, verifique o estado do Git e preserve as alterações em andamento. Leia o `AGENTS.md` e as instruções atuais do checkout antes de continuar; instruções de checkpoints antigos não substituem as regras vigentes.
- A atualização agendada do workflow GitHub `update-tournament-data.yml` continua pausada. Os comandos locais de atualização e validação de dados permanecem disponíveis e inalterados.

# Modelo para publicações

- Qualquer modelo disponível pode preparar, publicar e verificar o live. Registre o modelo usado na publicação ou no encaminhamento.

# Publicação a partir de qualquer chat

- Leia [o procedimento de publicação](docs/publicacao-oficial.md). O chat de origem publica diretamente quando tiver acesso funcional ao conector Sites do projeto `appgprj_6a68269688848191accea7675bbb56b3`. O destino é `https://tcgtd.com.br`.
- Consulte a versão live, os deploys em andamento e o SHA da fonte antes de preparar o build e novamente antes de publicar. Incorpore correções publicadas que estejam ausentes no checkout. Para a v129, confirme a presença da fonte `7661a48` ou das duas correções equivalentes já validadas. Se o live avançar, reconcilie as mudanças e valide o novo pacote.
- Valide e congele o commit e o build. Sincronize o SHA exato na branch de hospedagem indicada pelo Sites. Gere o TAR do build, salve a versão com `save_site_version`, publique o ID retornado com `deploy_site_version`, acompanhe por `get_deployment_status` e verifique as rotas afetadas no domínio. O repositório de hospedagem recebe o deploy. O GitHub continua sendo a fonte de desenvolvimento.
- Quando o conector estiver indisponível no chat de origem, envie o mesmo pacote validado ao [Atualizador Oficial do Site](https://chatgpt.com/local/01a13f42-0ed0-7244-b9ae-30ce60f2f020), ID `01a13f42-0ed0-7244-b9ae-30ce60f2f020`. Confira o estado da publicação nesse chat antes de encaminhar ou retomar.
- Retome versões salvas e deploys existentes pelos seus IDs. Se o SHA já estiver no ar, apenas confirme o resultado. Preserve o pacote validado e evite publicação concorrente.
- A autorização permanente de 08/11/2026 cobre a publicação de mudanças no site e de dados gerados localmente, inclusive pelo refresh agendado. Publique quando houver mudanças relevantes e as verificações aplicáveis passarem. Registre a conclusão, as falhas e as pendências.

# Fluxo obrigatório: local antes do live

Este projeto usa um fluxo de publicação em duas etapas. Toda solicitação de alteração deve seguir estas regras, salvo quando o usuário pedir explicitamente outro procedimento para aquela solicitação.

## 1. Implementação e validação local

- Faça primeiro todas as alterações no projeto local.
- Preserve o site que já está no ar durante esta etapa.
- Execute as verificações locais proporcionais à mudança, incluindo build, testes e validação das rotas ou funcionalidades afetadas.
- Quando útil, disponibilize ou reutilize a prévia local para o usuário conferir.
- Não crie uma versão de produção, não faça deploy e não altere o ambiente live nesta etapa.

## 2. Publicação e verificação do live

- Publique exatamente a versão validada localmente. A autorização permanente dispensa confirmação por versão. Pedidos expressos de prévia, teste ou trabalho apenas local ficam nessa etapa.
- Aguarde a conclusão do deploy e faça testes básicos no domínio de produção e nas rotas afetadas.
- Informe separadamente o resultado da publicação e da verificação no live.
- Se a publicação falhar, preserve a versão anterior no ar sempre que possível e explique o próximo passo.

## Mudanças exclusivamente de produção

Alterações que só existem no ambiente hospedado, como DNS, domínio, política de acesso, segredos, variáveis de ambiente ou dados reais, exigem confirmação explícita antes de modificar o live. Sempre faça primeiro todas as verificações locais ou somente leitura que forem possíveis.
