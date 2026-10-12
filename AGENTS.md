# Repositório canônico e continuidade

Estas orientações valem para todos os chats do TCG Tactical Database, inclusive os vinculados ao projeto Sites `appgprj_6a68269688848191accea7675bbb56b3`.

- O repositório principal é `https://github.com/gardinalix/tcgtd.git`, com `main` como branch padrão e `origin` apontando para o GitHub.
- O remoto antigo do Sites permanece como `sites-source`, apenas para referência da hospedagem. Não o use como fonte principal para continuar o desenvolvimento.
- O checkout local canônico é `E:\Codex\2026-04-19-we-need-to-create-a-full`.
- Chats na nuvem devem usar seu próprio checkout autorizado do repositório GitHub; o caminho local no disco `E:` não é um requisito nesses ambientes.
- Referência histórica da migração em **2026-10-11**: commit `21a25db`. Ao retomar o trabalho, use o estado atual de `origin/main`, em vez de restaurar esse checkpoint ou uma cópia antiga do Sites.
- Antes de sincronizar, verifique o estado do Git e preserve as alterações em andamento. Leia o `AGENTS.md` e as instruções atuais do checkout antes de continuar; instruções de checkpoints antigos não substituem as regras vigentes.
- A atualização agendada do workflow GitHub `update-tournament-data.yml` continua pausada. Os comandos locais de atualização e validação de dados permanecem disponíveis e inalterados.

# Fluxo obrigatório: local antes do live

Este projeto usa um fluxo de publicação em duas etapas. Toda solicitação de alteração deve seguir estas regras, salvo quando o usuário pedir explicitamente outro procedimento para aquela solicitação.

## 1. Implementação e validação local

- Faça primeiro todas as alterações no projeto local.
- Preserve o site que já está no ar durante esta etapa.
- Execute as verificações locais proporcionais à mudança, incluindo build, testes e validação das rotas ou funcionalidades afetadas.
- Quando útil, disponibilize ou reutilize a prévia local para o usuário conferir.
- Não crie uma versão de produção, não faça deploy e não altere o ambiente live nesta etapa.

## 2. Aprovação para publicar

- Depois da validação local, informe claramente que a alteração está **pronta localmente** e resuma o que foi verificado.
- Peça confirmação explícita antes de publicar, por exemplo: **“Está pronto localmente. Posso publicar no live?”**
- Uma solicitação para alterar, corrigir, implementar ou testar não conta como autorização para publicar.
- Só considere autorizado o deploy quando o usuário responder de forma inequívoca, como “pode publicar”, “publique” ou equivalente.

## 3. Publicação e verificação do live

- Após a autorização, publique exatamente a versão validada localmente, sem acrescentar mudanças não testadas.
- Aguarde a conclusão do deploy e faça testes básicos no domínio de produção e nas rotas afetadas.
- Informe separadamente o resultado da publicação e da verificação no live.
- Se a publicação falhar, preserve a versão anterior no ar sempre que possível e explique o próximo passo.

## Mudanças exclusivamente de produção

Alterações que só existem no ambiente hospedado, como DNS, domínio, política de acesso, segredos, variáveis de ambiente ou dados reais, exigem confirmação explícita antes de modificar o live. Sempre faça primeiro todas as verificações locais ou somente leitura que forem possíveis.
