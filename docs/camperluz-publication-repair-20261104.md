# Reconhecimento restrito da Camperluz — 04/11/2026

Execução investigada: https://github.com/informatica-byte/RankingDaCompra/actions/runs/41911062020 . Os 1.491 testes passaram, mas validate-site impediu publicação por anúncio MLB3954862383 e afiliado compartilhados em duas páginas. Nenhum validador removido.

O backup local de 01/11 (2) contém os dois IDs com o mesmo título original, anúncio MLB3954862383, catálogo MLB45553868 e afiliado https://meli.la/1WbosCJ. O erro atual confirma essas mesmas identidades; o alias já publicado aponta para a principal. Não se importou o backup nem se consultou Firestore.

A mudança editorial do título no registro g3QWQpsMAD73Kg7gMUzm rompeu a igualdade literal usada pelo agrupamento. Acrescentada prova revisada e delimitada aos dois IDs e títulos exatos (novo e anterior no principal), anúncio, catálogo e afiliado. Página principal fixa: g3QWQpsMAD73Kg7gMUzm. Endereço secundário mMWeLANeahGbxGFHmpie continua como encaminhamento noindex,follow para ela; nenhum cadastro unido ou excluído.

Reprodução falhou antes do ajuste (2 páginas em vez de 1) e passou após ele. Testes incluem ordem invertida, pontuação maior no secundário e preservação dos objetos; testes genéricos exigem recusa para outro ID, título/modelo, anúncio, catálogo, afiliado ou falta de anúncio explícito. 1.500 testes aprovados. Invariantes preservam 562 produtos e 615 URLs, preços, histórico e afiliados. Publicação editorial usa arquivos locais, sem autenticação/leitura Firestore e sem repetir conferências.

Publicação confirmada: fonte `9832d63aa8a8b5b2a505a13d1cbec2652d07e7ea`, geração `c0922d57a27814f5412afd7cc3021cecbdb4aeab`. Sitemap 41912203272, integridade 41912203325 e Pages 41912285601 aprovados. Principal e alias HTTP200, encaminhamento e afiliado preservados; catálogo público com 562 produtos integralmente iguais à base. Prova `outputs/melhorias-integrais-20261030/verificacao-camperluz-repair.json`. Retomada por ID registrada sem refazer revisões.
