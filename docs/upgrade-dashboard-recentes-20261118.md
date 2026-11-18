# Destaque de recentes no dashboard — 18/11/2026

Base `0989e5e03`. A central já selecionava os seis cadastros elegíveis mais recentes por data de cadastro, sem usar a última edição. Essa regra e as exclusões de ocultos/quarentena permanecem intactas.

Melhorias: atalho perto do início do painel, bloco de recentes antes dos relatórios da central, data de cadastro visível e distinta da confirmação de publicação, cópia de texto/link e cópia de link isolado. Mantidos os três canais sociais existentes, fotos e conferência da página/foto. A cópia exige sessão ativa e ambos os estados de confirmação; não registra venda, não publica em redes e não altera produto. Falha de clipboard orienta cópia manual sem alegar sucesso.

QA de layout e integração com dados fictícios em 360/390/1280 px, usando o HTML real e os manipuladores atuais, mas removendo SDKs e scripts de autenticação/servidor: seis cartões, sem rolagem horizontal, alvos de toque de 44 px, proteção de sessão/publicação, texto editado preservado. Não representa uma sessão real autenticada nem confirmação dos seis produtos atualmente na conta. Nenhuma mensagem, postagem, download de foto, consulta Firestore ou gravação foi feita no teste.

Validação completa: 1.599 testes aprovados, 627 URLs/571 produtos. Alterações restritas ao dashboard, testes e este registro; cadastros, links, índices públicos, sitemap, vitrine, Top 6, comparativos, vídeos e consultas SEO/GA4 preservados. Medidor privado de consumo e sua validação mantidos.

Evidências na raiz Codex: `outputs/upgrade-dashboard-20261118/qa.json`, capturas em três larguras e `tests.log`. Após implantação, repetir fixture com o HTML publicado e registrar o commit/execução nos documentos de continuidade. Não refazer fichas nem gerar catálogo para este upgrade.
