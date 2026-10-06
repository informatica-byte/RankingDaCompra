# Implantação segura das dependências

As correções de preço não alteram contas, regras implantadas, índices ou cobrança. O projeto permanece no plano existente. Não ative enforcement do App Check enquanto os geradores legítimos ainda usam consultas REST públicas.

## Antes de restringir acesso público

1. Comparar regras ativas com `firestore.rules` e exportar índices atuais, sem sobrescrever índices existentes.
2. Conferir métricas de tokens válidos/inválidos do App Check para site, dashboard e celular. Verificar as contas administradoras e os jobs.
3. Migrar os geradores para identidade autenticada com menor privilégio, mantendo os arquivos públicos estáticos usados pelo visitante. Testar isso em homologação; não publicar credenciais no HTML nem no Git.
4. Separar campos públicos de dados administrativos e proteger a criação de eventos contra consumo indevido. Validação de campos não é rate limiting.
5. Só então revisar permissões e ativar enforcement, com teste de todos os clientes e plano de reversão. Registrar o que efetivamente foi implantado, data e responsável.

## Preços e automações

Toda gravação automática precisa do contrato de prova do robô. IA online não é alternativa automática em lote. HTTP 403, quota, CAPTCHA ou erro de rede não renovam a confirmação individual. Nunca aumentar a taxa de sucesso removendo essas proteções.

O gerador não repete HTTP 429. O job distingue publicação preservada de novos dados publicados. O usuário pode editar/conferir manualmente e publicar ao terminar; o agendamento continua uma vez por dia.

## Medição e buscadores

O tanque do dashboard é estimativa manual, não saldo ao vivo. CSV de páginas ausente é dado desconhecido, não zero. Importar páginas, consultas, gráfico e filtros do mesmo período; usar a data real da cobertura de indexação. Reimportar um arquivo antigo não o torna atual.
