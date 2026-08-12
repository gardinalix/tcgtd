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
