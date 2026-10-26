# Proteção contra novos cadastros duplicados — 26/10/2026

## Comportamento

Os dois painéis bloqueiam a criação quando o mesmo anúncio ou link de afiliado já pertence a outro cadastro. A mensagem orienta reutilizar o cadastro existente; no painel móvel, o atalho de carregamento continua disponível. Editar links também passa pela proteção. Preços e a conferência diária não participam dessa consulta e não são recalculados.

Não há união automática por nome, foto, campanha ou categoria. Dois vendedores claramente identificados podem ter anúncios distintos do mesmo modelo. Se apenas o catálogo estiver identificado, sem o vendedor, uma colisão pede revisão em vez de afirmar que se trata de outro anúncio. Uma URL ambígua, contraditória, inválida ou sem código não produz um novo cadastro aleatório.

Para novos cadastros, use o link completo com MLB ou o endereço `/product/loja/produto` da Shopee. Cole o link curto somente no campo de afiliado. Não se tenta resolver links por scraping, API de preços ou contorno de CAPTCHA.

## Funcionamento técnico

- `product-uniqueness.js`: normaliza identificadores reais do anúncio e links, preserva diferenças de anúncios explícitos e calcula chaves SHA-256. Não usa preço ou título como identidade.
- `product-identities.json`: índice estático de hashes e IDs, construído a partir da fonte completa já lida pelo gerador, incluindo pausados e ignorando exclusões confirmadas. Não contém nomes, preços, tokens ou URLs originais. Enquanto o índice não estiver pronto ou carregado, a criação falha de forma segura e mantém o formulário.
- `configuracoes/identidades-produtos-v1`: reserva transacional de hashes e IDs. Cada salvamento compara os candidatos com os documentos atuais, ignora referências a documentos realmente removidos e registra a identidade junto com a gravação do produto. Dois salvamentos simultâneos disputam a mesma reserva; apenas um pode criar a repetição.
- Referências do índice que se tornaram antigas não bastam para bloquear: o documento relacionado é relido e sua identidade atual é conferida. O ID escolhido para um novo cadastro também não pode estar no registro de exclusões definitivas.

O índice de publicação não exige nova leitura de todos os documentos: reutiliza a consulta completa normal do sitemap. Os salvamentos consultam apenas os candidatos relacionados, com limite explícito; a reserva técnica é uma operação normal nas cotas existentes do Firestore. Não se habilita cobrança, serviço ou regra de acesso. O userscript de preços não foi alterado.

## Limites

Esta proteção cobre os fluxos atualizados dos painéis. Alterações manuais no console, scripts administrativos externos ou abas antigas sem atualização não devem ser usados para criar produtos. O utilitário de recuperação de backups é uma operação administrativa distinta e deve passar por revisão antes de restaurar cadastros apagados. Não existe prova automática de que URLs curtas diferentes ou modelos descritos de forma incompleta sejam o mesmo produto; nesses casos, forneça o link completo e reutilize o cadastro confirmado.

Nenhum cadastro real é criado, mesclado ou excluído durante os testes. Use **nova oferta no cadastro existente** para divulgar de novo um produto já salvo.
