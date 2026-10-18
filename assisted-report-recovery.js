(function (root) {
  'use strict';
  // Only browser storage and already-loaded product data. No network, SDK,
  // credentials, token access, background tasks or deletion of prior history.
  function read(storage, key) {
    try { return storage?.getItem(key) || null; } catch { return null; }
  }
  function latest({ local, session, key, day }) {
    const candidates = [read(local, key), read(session, key)].map(raw => {
      try {
        const value = JSON.parse(raw);
        return value && !Array.isArray(value) && value.dia === day
          && Number.isFinite(Date.parse(value.atualizadoEm)) ? value : null;
      } catch { return null; }
    }).filter(Boolean);
    candidates.sort((a, b) => Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm));
    return candidates[0] || null;
  }
  function persist({ local, session, key, roundKey, snapshot }) {
    const result = { primary: false, backup: false, session: false };
    try { local.setItem(key, snapshot); result.primary = true; } catch {}
    try { local.setItem(roundKey, snapshot); result.backup = true; } catch {}
    // Also refresh an existing session fallback, so it cannot win later with
    // an unrelated stale state after a failed persistent write.
    if (!result.primary || !result.backup || read(session, key)) {
      try { session.setItem(key, snapshot); result.session = true; } catch {}
    }
    return result;
  }
  function recover({ products, day, reviewToday, results, millis, dayOf, number, source }) {
    if (reviewToday) return [];
    const recovered = [];
    for (const product of products || []) {
      const checked = millis(product.precoAtualizadoManualmenteEm);
      if (!product.id || product.conferenciaPausada === true || !checked || dayOf(checked) !== day
        || millis(product.conferenciaReativadaEm) > checked) continue;
      const value = number(product.precoConferenciaValor);
      if (!Number.isFinite(value) || value <= 0 || !product.precoConferenciaId) continue;
      const existing = results.get(product.id);
      if (existing?.status === 'confirmado' && (existing.confirmacaoId === product.precoConferenciaId
        || Date.parse(existing.confirmadoEm) >= checked)) continue;
      const robot = /^robo_assistido_/.test(String(product.precoConferidoPor || ''));
      recovered.push([product.id, {
        titulo: String(product.titulo || ''), status: 'confirmado', preco: value,
        // The saved confirmation does not retain the old price. Never invent it.
        precoAnterior: null, fonte: robot ? String(product.precoConferenciaIAFonte || source(product) || '') : source(product),
        confirmadoEm: new Date(checked).toISOString(), origem: String(product.precoConferidoPor || 'cadastro_salvo'),
        proofVersion: Number(product.precoProvaVersao) || 0,
        evidencia: robot ? String(product.precoConferenciaIAEvidencia || '') : 'Confirmação humana registrada no cadastro',
        confirmacaoId: product.precoConferenciaId, recuperadoDoCadastro: true,
      }]);
    }
    return recovered;
  }
  function report({ snapshot, all, pending, failures, unavailable, active, paused, generatedAt }) {
    const data = JSON.parse(snapshot), pendingIds = new Set(pending.map(item => item.id));
    const currentFailures = failures.filter(item => pendingIds.has(item.id));
    const currentUnavailable = unavailable.filter(item => pendingIds.has(item.id));
    const byId = new Map([...currentFailures, ...currentUnavailable].map(item => [item.id, item]));
    const unavailableIds = new Set(currentUnavailable.map(item => item.id));
    const totals = all.filter(product => product.conferenciaPausada !== true);
    return {
      ...data, versao: 3, exportadoEm: generatedAt,
      resumoAtual: {
        total: totals.length, conferidos: totals.length - pending.length, restantes: pending.length,
        pausados: all.length - totals.length, ativa: Boolean(active), pausada: Boolean(paused),
        base: 'fila_carregada_e_confirmacoes_salvas',
      },
      historicoFalhas: data.falhas, historicoIndisponiveis: data.indisponiveis,
      historicoConferidos: data.conferidos,
      conferidos: totals.filter(product => !pendingIds.has(product.id)).map(product => product.id),
      falhas: currentFailures.map(item => [item.id, item]),
      indisponiveis: currentUnavailable.map(item => [item.id, item]),
      pendenciasAtuais: pending.map(product => {
        const entry = byId.get(product.id);
        return { id: product.id, titulo: product.titulo,
          tipo: unavailableIds.has(product.id) ? 'indisponivel' : entry ? 'revisao' : 'sem_resultado_recuperado',
          motivo: entry?.motivo || 'Sem resultado nesta cópia recuperada. Conferir o anúncio antes de concluir.',
          tentativaEm: entry?.tentativaEm || null };
      }),
    };
  }
  root.RDCAssistedReportRecovery = { latest, persist, recover, report };
})(typeof window !== 'undefined' ? window : globalThis);
