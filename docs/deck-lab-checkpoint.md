# Estado atual — 09/10/2026: cópia local restaurada ao site no ar

O usuário substituiu a solicitação de publicação por restauração local: usar o online como referência e retirar todas as pendências não publicadas do projeto ativo. A publicação daquele pacote foi cancelada. Não retomar as funcionalidades arquivadas nem publicar o pacote antigo com base nas autorizações anteriores.

Fonte restaurada: commit 8791678, ajustes da logo v3 que já estão no live e payloads/assets da cópia `publication-baseline-pinned`. Os 44 arquivos JS/CSS dessa cópia foram comparados com https://tcgtd.com.br em 09/10 e são idênticos. Catálogo publicado: 892 cartas e 107 recursos. Deck Lab, mapa de recomendações novo, importador Discord e pacote ST11–ST14 foram retirados do projeto ativo.

Estado anterior, dados, configuração local e histórico Git preservados separadamente em `E:\Codex\work\tcgtd-before-online-restoration-20261009`. Este backup é para recuperação, não uma fila de publicação. Não reintroduzir seu conteúdo automaticamente.

O usuário escolheu expressamente **manter a atualização diária ativa**. Por isso os caches oficiais, SQLite, preços, credenciais locais e runtime foram conservados; eles não são uma cópia do banco remoto. A aplicação e os payloads públicos foram restaurados à versão online. Uma próxima atualização poderá gerar dados locais mais recentes, inclusive cartas novas. Isso é permitido por essa preferência e não significa restaurar o código das funcionalidades descartadas.

O site no ar, domínio, audiência e binding DB não foram modificados. Trabalho futuro deve partir desta base restaurada e seguir AGENTS.md.

Validação desta restauração: 173/173 testes JavaScript aprovados; build Vite aprovado. Os 44 arquivos JS/CSS reconstruídos são byte a byte iguais à cópia publicada verificada, sem chunks extras. Payloads web/dist equivalentes ao online; Worker e logo preservados. Auditoria independente confirmou fonte sem módulos pendentes. O teste de marca foi atualizado para a logo v3 já publicada, sem mudança de produto.
