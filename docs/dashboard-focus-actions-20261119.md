# Central de foco: ações no celular — 19/11/2026

Problema reproduzido em teste isolado: os dois atalhos externos da Central de foco tinham fonte de 11 px e altura de 33 px. CSS limitado a até 700 px passa a fonte a 14 px, altura mínima a 44 px, permite quebra de texto e aumenta o espaço entre ações a 12 px. URLs e funções intactas.

QA usa os dois links extraídos do gerador existente, CSS real, scripts removidos e rede bloqueada. Em 360 px: alturas 57/44 px, em 390 px: 44/44 px, sem corte lateral dos alvos. Em 768 px: preservados 33 px e 11 px. Nenhum link aberto, nenhuma consulta de Analytics ou Search Console, nenhum cadastro ou afiliado alterado. Não repete cópia, lista de produtos nem conferência de anúncios. Teste de apresentação isolado, não sessão real/aparelho físico.

Evidência local: outputs/dashboard-focus-actions-20261119/qa.json na raiz do Codex. Próxima etapa: confirmar implantação e CSS público; demais áreas não são declaradas aprovadas por este teste.
