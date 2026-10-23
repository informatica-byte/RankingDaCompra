import { writeFile } from 'node:fs/promises';
import { collectUsage } from './firebase-usage-metrics.mjs';
try {
  const data = await collectUsage({ token: process.env.RDC_MONITORING_ACCESS_TOKEN });
  await writeFile('.firebase-usage-public.json', JSON.stringify(data, null, 2) + '\n');
  console.log('Métrica obtida. Arquivo público limitado ao total e horário.');
} catch (error) {
  // collectUsage só produz mensagens limitadas, sem o corpo remoto ou token.
  console.error(String(error?.message || '').startsWith('Consulta de métricas HTTP')
    ? error.message : 'Medição indisponível ou inválida; último arquivo preservado.');
  process.exitCode = 1;
}
