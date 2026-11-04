# Política editorial e fila de revisão — 04/11/2026

Pedido: corrigir as instruções da IA de análises/comparações nos dois painéis e separar o restante, sem reescrever cadastros em lote.

- `editorial-ai-policy.js`: política compartilhada nas instâncias geradora/revisora já existentes. Nenhum modelo, plano, credencial, ferramenta de segurança ou quantidade de chamadas alterado. Instruções distinguem anúncio, documento e teste, preservam variantes e recusam completar lacunas por memória.
- Checagem local complementar recusa padrões limitados de promessas absolutas em rascunhos, inclusive contingência. Não é verificação semântica completa; não garante verdade ou qualidade equivalente à revisão humana. Permanecem validadores anteriores e revisão antes de salvar. Não ativa App Check enforcement nem bloqueios de usuários/produtos.
- `editorial-review-queue.json`: 248 itens do catálogo publicado local: 8 dependências de fonte, 239 ainda não triados e 1 indício heurístico. Não são 248 erros comprovados. Concluídos inalterados não são reabertos; mudança de fingerprint volta à triagem. Fila segue ordem GA4 salva de 01–28/10/2026, sem publicar métricas brutas. CI reutiliza ordem anterior quando evidência privada não está presente. Novos itens sem sinal ficam após os já ordenados; não se inventa demanda.
- Os dois painéis oferecem seção “Revisão editorial” com carregamento sob demanda, grupos e download. Usa apenas arquivo estático, sem Firebase ou IA. Atualiza na geração normal das páginas, com snapshots locais, sem exportações recorrentes adicionais.
- Fontes consultadas: documentação oficial Firebase AI Logic, https://firebase.google.com/docs/ai-logic/system-instructions . Não testamos chamadas reais à IA, para não consumir cota ou gerar custos. Testes locais não provam comportamento de toda resposta futura.
- Regressão preexistente de data corrigida apenas na fixture de histórico: relógio fixo em 07/10/2026, mantendo janela de 30 dias e todas as asserções.
- Ponto editorial preservado: kit ventilador/LED `fflXJkY0fRQJg8t2QZqn`, potes `FlQInLlTCwVdemK0g3rZ`, cabides `fMwDJ0aYUKjwcpHFiRus`. Nenhuma dessas fichas revisada neste trabalho global.

Publicação verificada: fonte `2245522fd35a085cd56018342c6bd0b31ae1b152`, Pages `41868521300` e integridade `41868522563` aprovados. 1.488 testes passaram. Código/JSON públicos HTTP200 e 562 produtos idênticos à base; prova `outputs/melhorias-integrais-20261030/verificacao-politica-editorial.json`. QA local em 360/1280 px, sem sessão autenticada, Firebase ou chamada real à IA. Retomada por ID registrada na continuidade.
