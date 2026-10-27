# Robô de links — versão 2.5.0

## Instalação e uso

Abrir https://rankingdacompra.com.br/bot-links.user.js no Chrome com Tampermonkey
e confirmar **Atualizar**. O `@name` e o `@namespace` do robô antigo foram
mantidos para substituir essa instalação. O nome antigo “Bot local de preços”
no gerenciador é somente a identidade da extensão; a versão 2.5.0 é de links.
Não instalar uma cópia independente em paralelo. Não remover o script do tanque.

Pare qualquer lote antigo antes da atualização. Depois recarregue os painéis.
O novo bloco **Conferência dos links de afiliados** precisa mostrar 2.5.0
conectado. Escolha Carregar links e depois Conferir pendentes. Nada começa
sozinho. Rodadas limitadas a 10, 20 (padrão) ou 50 links, com intervalo de cinco
segundos entre itens. Resultados ficam apenas no navegador e podem ser baixados.

Não é necessário executar diariamente. A conclusão vale para o momento da
leitura, não garante estoque futuro. A retomada usa o mesmo produto, nome e
URLs (SHA-256 local), reaproveitando confirmações compatíveis por até sete dias;
marcar “Conferir novamente” força nova consulta. Links ou nomes alterados não
herdam confirmação anterior. Cadastros pausados podem ser lidos sem reativação.

## O que o robô faz — e o que não faz

- Abre o próprio link de afiliado, não apenas o endereço técnico. Mantém a URL
  de entrada para a navegação, seguindo os redirecionamentos normais da loja.
- Mercado Livre: confere nome/modelo e identidade do anúncio/catálogo. Catálogo
  igual não mascara um vendedor identificado como diferente. Se o `wid` sumir,
  exige o código do anúncio principal visível quando essa for a referência.
- Shopee: confere shop/item quando existe endereço original ou direto registrado.
  Sem identificação suficiente, um nome compatível fica **a confirmar**, não
  ganha selo de produto correto por semelhança. Não associa automaticamente
  um ID de catálogo do Mercado Livre a um ID da Shopee.
- Exige título compatível e ação de compra habilitada na área principal para
  “ativo e produto confirmado”; recomendações/carrosséis não são evidência.
- Não lê preços ou parcelas. Não clica Comprar, não adiciona ao carrinho, não
  efetua compra, não usa cookies/tokens via API e não tenta resolver CAPTCHA.
- Não altera links, preços, análises, pausas, identidade, histórico ou cadastros.
  As funções antigas de consulta de preço são bloqueadas na nova instalação e
  nos painéis informativos. O legado 2.4.15 permanece no repositório para
  compatibilidade histórica e seus testes; não é o instalador atual da interface.

## Classificações conservadoras

1. **Ativo e produto confirmado:** identidade e ação principal coerentes.
2. **Indisponível:** aviso principal explícito vinculado à identidade esperada.
3. **Destino diferente:** código, loja, modelo, edição ou capacidade contraditórios.
4. **A confirmar:** nome/código insuficientes ou disponibilidade não comprovada.
5. **Verificação humana/bloqueio** ou **Login:** pausa para a pessoa, sem bypass.
6. **Erro de comunicação:** timeout ou canal ocupado, nunca convertido em fora do ar.

Depois de resolver pessoalmente uma verificação, tocar em Conferir pendentes.
Não recarregar nem iniciar em outro painel durante uma rodada. O canal aceita
apenas pedido/produto/sessão/URL correspondentes; respostas antigas são ignoradas.
Nenhum status pausa ou exclui automaticamente o produto no Firestore.

## Privacidade, leituras e limitações

Os painéis expõem apenas uma projeção mínima de identidade e links, após
confirmar o login e a mesma sessão antes/depois da leitura. Reutilizam os
snapshots/cache de produtos; quando necessário, Carregar links pode causar
uma leitura da coleção dentro da cota existente. Não consulta visitas nem
recarrega o Firestore por item. Não ativa cobrança, serviços pagos ou bloqueios.

O relatório `rdc-affiliate-audit-report-v1` usa somente armazenamento local.
URLs finais ficam sem rastreamento, campos sensíveis são recusados/redigidos e
o relatório não contém preços, tokens ou respostas integrais de página.
Parâmetros legítimos do afiliado são usados na navegação, não regravados no
cadastro. A própria loja pode registrar o clique de teste no painel de afiliados;
esta ferramenta não registra vendas nem transmite eventos próprios ao Analytics.

Redirecionamentos para aplicativo, mudanças de layout, login, proteção de robôs
ou título genérico podem exigir revisão humana. Não prometer 100% de confirmação
nem usar só HTTP 200 como prova de anúncio ativo. Não há agendamento em nuvem.

## Arquivos e verificação

- `affiliate-link-audit.js`: identidade, evidência e projeção sem preços.
- `affiliate-link-bot.js`: canal local por pedido e sessão; sem APIs de credenciais.
- `affiliate-link-panel.js` e CSS: interface e relatório local nos dois painéis.
- `scripts/build-link-audit-bot.mjs`: gera `bot-links.user.js`, sem dependência remota.
- Testes de unidade, transporte e interface isolada, sem sessão de administrador,
  compras, escrita no Firestore ou consultas reais em lote às lojas.

A publicação do código não prova que o usuário confirmou a atualização no
Tampermonkey. Confirmar versão 2.5.0 na interface antes de iniciar a primeira rodada.
