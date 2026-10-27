# Continuidade editorial — produtos com mais visualizações

## Escopo e prioridade

Lote de 13 análises, além das sete aprofundadas anteriormente. Consulta somente
de leitura ao GA4 da propriedade 545546219, pelo Windsor.ai. Período: 28/09 a
25/10/2026, 28 dias completos, sem incluir o dia corrente incompleto.

Foram consultados `page_path_plus_query_string` e `screen_page_views`. O retorno
continha 490 linhas completas. Somaram-se páginas `/produto/` e entradas na raiz
com `produto=ID`, agrupadas pelo ID, sem multiplicar caminhos por UTM ou versões
de query string. Páginas do comparador não contam como acesso à análise.

Este lote cobre os outros produtos com pelo menos oito visualizações, excluindo
os sete já aprofundados. Empates não significam diferença de preferência.
São visualizações registradas, não usuários únicos, compradores ou vendas.
Não havia sinalizador confiável para excluir todos os testes históricos;
repetições e testes podem estar incluídos. Nenhuma configuração do Analytics
foi alterada. Os números não viraram selos públicos de popularidade.

| Produto | ID | Visualizações |
| --- | --- | ---: |
| Espumador Lotus 2 L | N1cKmru7WcRrMBSj4ut7 | 18 |
| Tênis Fit feminino | FWTjfbbohQT5qtJGYDBC | 11 |
| Puma Flyer Runner Mesh feminino | TaSttysuiLO2i5Rrb9hV | 11 |
| HP Laser MFP 135a | hokaCwafFsMcmt9QPBdX | 11 |
| TP-Link TL-WR840N | 2e2m7sDdRyGHq1Tzj8ra | 9 |
| LG 9.000 BTUs frio | 9Y8FuG1gZwVywVcUHPCg | 8 |
| NOVANTE HT1291 | UkgpEmnU2nSDUmOujW6W | 8 |
| New Hawaii 50 L | XXf1jGItNH4xwlZ136z3 | 8 |
| Massageador Nixzen | gmzJCKnbLsVLIZilQGSe | 8 |
| Kit Nakasaki | i1ii8KV1IYFAeAN3SPWH | 8 |
| Scooter Xplore | oVBbvfcldF36EbyYex8y | 8 |
| Tênis DM Damando | pvXy1mkDwgkYeeGFQoUd | 8 |
| Roadstar RS-7007BR | qRN6SoGfO6PrwR2rj96v | 8 |

## Conteúdo e fontes

`popular-analysis.json` contém perfil de uso, vantagens atribuídas à fonte,
limitações, perguntas específicas, cuidados na escolha e links para comparar.
Quando faltam dados técnicos, o texto explica o que perguntar em vez de criar
um benefício ou assumir que outro modelo tem a mesma ficha.

- HP: documentação oficial da 135a/4ZB82A, sem transferir Wi-Fi da 135w.
- TP-Link: ficha brasileira do TL-WR840N, com ressalva de revisão de hardware,
  taxas teóricas e portas 10/100. Não é análise do TL-WR840N W.
- LG: página do conjunto S3-Q09JA31E e relação da unidade externa
  S3UQ09JA31E. Pacote e sufixo do vendedor continuam a conferir.
- NOVANTE: revisão anterior do anúncio MLB6162191874, de 22/10/2026,
  identificando HT1291. A data editorial não renova essa leitura.
- Demais ofertas: informações do cadastro/anúncio já registrado; não houve
  nova leitura bem-sucedida de todas as páginas do vendedor nesta etapa.
- Xplore: orientação pública do DETRAN-PE como referência geral, não como
  classificação deste veículo. Removida a promessa pública de dispensa de CNH.
- Nixzen: termos comerciais não viraram eficácia terapêutica, diagnóstico ou
  prescrição. Não há teste clínico ou prático da equipe.

Os antigos resumos excessivamente categóricos foram substituídos apenas na
projeção pública. Nas 13 páginas, a análise revista substitui os dois painéis
antigos de prós/contras para não repetir blocos nem manter alegações antigas.
O catálogo informativo passa a usar o mesmo resumo, com título público neutro
para Xplore e Nixzen. Identificadores e URLs principais permanecem os mesmos.

## Proteções e continuidade

Não há alteração de preços, histórico, documentos do Firestore, cadastros,
afiliados ou seleção da vitrine. Não são iniciadas conferências de preço.
Não há mudança de cobrança, regras, App Check ou userscript de preços.

O enriquecimento exige ID/modelo e anúncio explicitamente compatíveis. Todos
os códigos de vendedor presentes precisam concordar; código de catálogo não
é tratado como código de vendedor. Uma troca futura de anúncio deve provocar
revisão humana, não transferência automática destas afirmações.

Testes verificam preservação de afiliados e canonical, escapes de HTML,
fontes permitidas, ausência de valores e idempotência. Exclusões registradas
e pausas continuam respeitadas. A verificação visual usa navegador isolado,
sem sessão de administração, gravações, Analytics ou visitas aos afiliados.

Ainda há outros produtos para aprofundar em próximos lotes. Não confundir
texto revisado com teste de produto ou confirmação recente de estoque.
