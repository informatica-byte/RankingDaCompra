# Melhorias de recuperação pública — 28/10/2026

Escopo: navegação informativa, home e comparador. Não altera cadastros, preços, fontes editoriais, imagens, links de afiliado, robôs, quarentenas ou regras do Firebase. Não inicia conferências nem cria novos agendamentos. A publicação utiliza o fluxo habitual já existente, inclusive sua regeneração estática de leitura quando acionada pela alteração do módulo informativo.

## Problemas e correções

- O carregador informativo esperava indefinidamente por cabeçalhos ou JSON de uma resposta travada. Agora expira em 12 segundos, interrompe a requisição quando suportado e libera nova tentativa. Chamadas simultâneas continuam compartilhando uma leitura e sucesso permanece só na memória, sem credenciais ou fallback para banco.
- A falha da rota da home podia substituir todo o HTML do app, apagando a seleção estática útil. Agora conserva Top 6, comparativos, vídeos e respectivos links, retira a mensagem de carregamento presa e acrescenta aviso acessível com tentativa manual.
- O comparador deixava a instrução de carregamento inicial sem ação de recuperação. Agora mantém um link para as análises e oferece um botão de retentativa. O modo de aprimoramento de uma busca existente continua preservando seus resultados ao falhar.
- O aviso sem JavaScript da home afirmava que era preciso ativá-lo para consultar guias que já estão no HTML. O texto agora explica que apenas os filtros e a comparação interativa precisam dele.

## Validação e limites

`scripts/test-informational-recovery.mjs` cobre compartilhamento/cache, timeout de rede e corpo, HTTP/JSON inválido, respostas tardias, conteúdo estático preservado e recuperação do comparador. `scripts/qa-informational-ui.mjs` testa os fluxos públicos no celular/desktop, com métricas, SDKs, banco e lojas bloqueados. Os cenários de 503 são locais e não derrubam o site publicado.

Os testes não são ensaio físico de todos os aparelhos, verificação de estoque das lojas nem auditoria dos consoles privados. Uma tentativa manual consulta apenas arquivos estáticos do próprio site. Nenhum clique de afiliado ou venda é enviado pelos testes.
