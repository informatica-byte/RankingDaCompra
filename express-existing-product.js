(function (root) {
  "use strict";
  function buildPatch(product, input, now) {
    const changes = {};
    for (const field of ["titulo", "link", "linkAfiliado", "foto"]) {
      const value = String(input[field] || "").trim();
      const previous = String(product[field] || (field === "foto" ? product.imagem : "") || "").trim();
      if (value !== previous) changes[field] = value;
    }
    if (!String(input.titulo || "").trim() || String(input.titulo).trim().length > 180) {
      throw Error("Informe o nome do produto, com até 180 caracteres.");
    }
    if ("foto" in changes) {
      let image;
      try { image = new URL(changes.foto); } catch { /* validated below */ }
      if (!image || image.protocol !== "https:" || image.username || image.password) throw Error("Informe uma URL HTTPS válida para a foto.");
    }
    const sourceChanged = "link" in changes;
    if (sourceChanged || "linkAfiliado" in changes) {
      const links = root.RDCOfferReplacement.validate(product, input);
      Object.assign(changes, sourceChanged ? root.RDCOfferReplacement.buildPatch(product, input, now) : { linkAfiliado: links.linkAfiliado });
    }
    return { changes, sourceChanged };
  }

  function mount(container, options) {
    let productId = "", expectedLink = "", baseline = null, busy = false, generation = 0;
    container.classList.add("express-existing");
    container.hidden = true;
    container.innerHTML = '<button type="button" class="btn azul" data-action="load">✏️ Carregar cadastro existente</button>' +
      '<div data-editor hidden><h3>Editar cadastro existente</h3><p class="mini">O rascunho acima será mantido. Somente os campos alterados abaixo serão salvos no produto original, sem criar outra página.</p>' +
      '<fieldset style="border:0;padding:0;margin:0"><label>Nome do produto<input class="campo" data-field="titulo" maxlength="180" /></label>' +
      '<label>Link completo do produto no Mercado Livre<input class="campo" data-field="link" type="url" inputmode="url" maxlength="1000" /></label>' +
      '<label>Link de afiliado do Mercado Livre<input class="campo" data-field="linkAfiliado" type="url" inputmode="url" maxlength="1000" /></label>' +
      '<label>URL da foto<input class="campo" data-field="foto" type="url" inputmode="url" /></label>' +
      '<label class="mini"><input data-field="sameProduct" type="checkbox" /> Se alterei os links, confirmei que continuam sendo do mesmo produto, modelo e versão.</label>' +
      '<p class="mini">Ao trocar o anúncio, o histórico é preservado. O preço anterior deixa de estar confirmado e ofertas antigas são desativadas: confira o novo preço antes de republicar.</p>' +
      '<button type="button" class="btn verde" data-action="save">💾 Salvar alterações no cadastro existente</button>' +
      '<button type="button" class="btn claro" data-action="cancel">Cancelar edição</button></fieldset></div>' +
      '<p class="status" data-status role="status" aria-live="polite"></p>';
    const find = selector => container.querySelector(selector);
    const field = name => find('[data-field="' + name + '"]');
    const status = (text, error = false) => {
      find("[data-status]").textContent = text;
      find("[data-status]").className = "status on " + (error ? "erro" : "ok");
    };
    const setBusy = value => {
      busy = value;
      find("[data-action=load]").disabled = value;
      find("fieldset").disabled = value;
    };
    const load = async () => {
      if (busy || !productId) return;
      const token = ++generation;
      baseline = null;
      find("[data-editor]").hidden = true;
      setBusy(true);
      status("Carregando somente este cadastro...");
      try {
        const product = await options.read(productId);
        if (token !== generation) return;
        if (!product) throw Error("Este produto foi excluído. Nenhum cadastro será recriado.");
        if (expectedLink) {
          const expectedId = root.RDCProductSaveSafety.listingId({ marketplace: "mercado_livre", link: expectedLink });
          const foundId = root.RDCProductSaveSafety.listingId({ marketplace: "mercado_livre", link: product.link });
          if (expectedId && foundId !== expectedId) throw Error("O cadastro encontrado pertence a outro anúncio ou não comprova o anúncio informado. Nenhum dado foi aberto para edição. Confira os links e prepare uma nova publicação.");
        }
        baseline = root.RDCProductSaveSafety.capture(product);
        for (const name of ["titulo", "link", "linkAfiliado", "foto"]) field(name).value = String(product[name] || (name === "foto" ? product.imagem : "") || "");
        field("sameProduct").checked = false;
        find("[data-editor]").hidden = false;
        status("Cadastro carregado. Edite abaixo e salve quando terminar.");
        field("titulo").focus();
      } catch (error) { if (token === generation) status("Não foi possível carregar: " + error.message, true); }
      finally { if (token === generation) setBusy(false); }
    };
    const save = async () => {
      if (busy || !baseline || !productId) return;
      const input = Object.fromEntries(["titulo", "link", "linkAfiliado", "foto"].map(name => [name, field(name).value.trim()]));
      input.sameProduct = field("sameProduct").checked;
      setBusy(true);
      try {
        const proposed = buildPatch(baseline, input, new Date().toISOString());
        if (!Object.keys(proposed.changes).length) { status("Nenhuma alteração para salvar."); return; }
        status("Salvando somente as alterações no cadastro original...");
        await options.save(productId, baseline, input);
        baseline = null;
        find("[data-editor]").hidden = true;
        status(proposed.sourceChanged
          ? "Anúncio substituído e histórico preservado. Confira o preço do novo anúncio e depois publique a vitrine."
          : "Alterações salvas no cadastro existente. Use Publicar vitrine para atualizar o site; não crie outra publicação.");
        find("[data-action=load]").focus();
      } catch (error) { status("Não foi possível salvar: " + error.message, true); }
      finally { setBusy(false); }
    };
    find("[data-action=load]").addEventListener("click", load);
    find("[data-action=save]").addEventListener("click", save);
    find("[data-action=cancel]").addEventListener("click", () => {
      if (busy) return;
      baseline = null;
      find("[data-editor]").hidden = true;
      status("Edição cancelada. Nenhuma alteração foi salva.");
      find("[data-action=load]").focus();
    });
    // The editor lives inside the preview form; Enter must never submit a new product.
    container.addEventListener("keydown", event => {
      if (event.key === "Enter" && event.target?.matches("input")) event.preventDefault();
    });
    return Object.freeze({
      show(id, sourceLink = "") {
        if (busy) return false;
        productId = String(id || ""); expectedLink = String(sourceLink || ""); baseline = null; ++generation;
        container.hidden = !productId;
        find("[data-editor]").hidden = true;
        find("[data-status]").className = "status";
        return true;
      },
      reset() { return this.show(""); },
      isBusy() { return busy; },
    });
  }
  root.RDCExpressExisting = Object.freeze({ buildPatch, mount });
})(typeof window === "object" ? window : globalThis);
