# Testes de publicação do sitemap — 23/10/2026

As execuções 39950805745 e 39950623393 pararam corretamente antes da publicação. Quatro regressões exigiam que o produto WO6BdDxEWWCCjBVJ0ygB ainda estivesse no catálogo público recém-gerado. A ausência de um produto na vitrine não invalida a revisão histórica nem autoriza sua reinserção.

As três suítes de regressão de fichas/formato agora usam uma captura mínima, independente e somente de testes, dos 31 produtos presentes no commit 9cab5b238. Ela não alimenta o gerador nem o Firestore. A cobertura de identidade, fonte, modelo, ANC, autonomia, formatos contraditórios e preservação de preços foi mantida. Fixtures ausentes falham explicitamente.

Uma integração adicional testa todos os produtos do catálogo público real sem exigir presença de cadastros históricos. Há também regressões para saída da vitrine, produto diferente, URL inválida e isolamento dos dados de teste.

O fluxo continua executando toda a suíte e o validador antes de publicar. A opção manual `preserve_published_prices` acrescenta uma proteção somente de leitura: compara os três campos de preço dos IDs existentes antes/depois da geração e após o rebase; divergências bloqueiam o push. Não muda o comportamento das atualizações diárias normais. Novos produtos usam seus próprios dados; a verificação não escreve nem exclui cadastros.

Verificação local: 808 testes aprovados, zero falhas e zero testes ignorados; validador aprovado para 579 URLs e 527 produtos da publicação anterior. Publicação e conferência ao vivo devem ser verificadas separadamente.
