(function () {
  'use strict';
  const api = window.RDCBestChoices;
  const loadedJson = async url => { const r=await fetch(url,{cache:'no-store'}); if(!r.ok)throw Error('Não foi possível carregar '+url);return r.json(); };
  function mount(host, adapter) {
    if (!host || host.dataset.bestChoicesMounted) return;
    host.dataset.bestChoicesMounted='true'; host.classList.add('best-admin');
    host.innerHTML='<details><summary>🏆 Melhores escolhas — produtos e rankings permanentes</summary><p>A seleção não vence no fim do dia. Os preços continuam dependendo da conferência diária. Salvar aqui não altera cadastros, preços, vídeos ou rankings existentes.</p><button type="button" data-best-load>Abrir seleção</button><div data-best-form hidden></div><p class="best-admin-status" role="status" aria-live="polite" data-best-status></p></details>';
    const loadButton=host.querySelector('[data-best-load]'), form=host.querySelector('[data-best-form]'), status=host.querySelector('[data-best-status]');
    let config={}, products=[], guides=[], selectedIds=[], selectedUrls=[], saveConfig, pending=false, categoryNames=new Map(), priceStatuses={};
    const productById=new Map();
    const showPicked=()=>{
      form.querySelector('[data-best-count]').textContent=selectedIds.length+' de '+api.MAX_PRODUCTS+' produtos selecionados';
      form.querySelector('[data-best-picked]').innerHTML=selectedIds.map((id,index)=>{
        const p=productById.get(id);
        return '<li><span>'+api.esc(p?.titulo || 'Produto não publicado: '+id)+'<small>'+api.esc(categoryNames.get(p?.categoria) || p?.categoria || 'Revise a disponibilidade antes de remover')+'</small></span><button type="button" data-best-up="'+api.esc(id)+'" '+(!index?'disabled':'')+' aria-label="Subir '+api.esc(p?.titulo||id)+'">↑</button><button type="button" data-best-down="'+api.esc(id)+'" '+(index===selectedIds.length-1?'disabled':'')+' aria-label="Descer '+api.esc(p?.titulo||id)+'">↓</button><button type="button" data-best-remove="'+api.esc(id)+'" aria-label="Retirar '+api.esc(p?.titulo||id)+' da seleção">Retirar</button></li>';
      }).join('');
    };
    const refreshOptions=()=>{
      const term=api.normalize(form.querySelector('[data-best-search]').value);
      const cat=form.querySelector('[data-best-category]').value;
      const available=products.filter(p=>(!cat||p.categoria===cat)&&api.normalize(p.titulo+' '+p.categoria).includes(term)&&!selectedIds.includes(String(p.id)));
      form.querySelector('[data-best-product]').innerHTML='<option value="">Escolha um produto já cadastrado</option>'+available.map(p=>'<option value="'+api.esc(p.id)+'">'+api.esc(p.titulo)+'</option>').join('');
    };
    const setDraftTitle=value=>{form.querySelector('[data-best-title]').value=value;status.textContent='Título sugerido com a seleção atual. Revise e salve; não foi consultada uma IA paga.';};
    loadButton.addEventListener('click',async()=>{
      loadButton.disabled=true;status.textContent='Carregando seleção sem reler a coleção de produtos…';
      try {
        const [published, catalogue, manifest, live, index, priceStatus] = await Promise.all([loadedJson('/site-config.json'),loadedJson('/vitrine-publica.json'),loadedJson('/best-choices-guides.json'),adapter(),loadedJson('/search-index.json'),loadedJson('/mercadolivre-status.json').catch(()=>({products:{}}))]);
        categoryNames=new Map((index.categories||[]).map(c=>[c.id,c.name]));priceStatuses=priceStatus.products||{};
        if (!Array.isArray(catalogue.products)||!Array.isArray(manifest.guides)||typeof live.saveConfig!=='function') throw Error('Dados de seleção incompletos.');
        config={...published,...live.config}; saveConfig=live.saveConfig; guides=manifest.guides;
        products=api.mergeCatalogues(catalogue.products,live.products || []);
        products.forEach(p=>productById.set(String(p.id),p));
        const seeded=api.seedConfig(config,products,guides);
        selectedIds=[...new Set(seeded.bestChoicesProductIds.map(String))];
        selectedUrls=[...new Set(seeded.bestChoicesGuideUrls)];
        form.innerHTML='<label for="'+host.id+'-title">Título permanente para as buscas</label><input id="'+host.id+'-title" data-best-title type="text" minlength="20" maxlength="75"><div class="best-buttons"><button type="button" data-best-suggest>Sugerir título com a seleção</button></div><label for="'+host.id+'-search">Buscar produto pelo nome</label><input id="'+host.id+'-search" data-best-search type="search" placeholder="Ex.: JBL, roteador ou notebook"><label for="'+host.id+'-category">Filtrar categoria</label><select id="'+host.id+'-category" data-best-category><option value="">Todas as categorias</option>'+[...new Set(products.map(p=>p.categoria))].sort().map(cat=>'<option value="'+api.esc(cat)+'">'+api.esc(categoryNames.get(cat)||cat)+'</option>').join('')+'</select><label for="'+host.id+'-product">Produto para destacar</label><div class="best-admin-row"><select id="'+host.id+'-product" data-best-product></select><button type="button" data-best-add>Adicionar</button></div><p data-best-count></p><ul class="best-picked" data-best-picked></ul><h3>Rankings e categorias em destaque — até '+api.MAX_GUIDES+'</h3><p>São links para comparativos já publicados. Produtos de categorias diferentes não disputam o mesmo ranking.</p><div data-best-guides>'+guides.map(g=>'<label class="best-guide-option"><input type="checkbox" data-best-guide value="'+api.esc(g.url)+'" '+(selectedUrls.includes(g.url)?'checked':'')+'><span>'+api.esc(g.title)+'</span></label>').join('')+'</div><div class="best-buttons"><button type="button" data-best-save>Salvar melhores escolhas</button><a class="best-button" href="https://github.com/informatica-byte/RankingDaCompra/actions/workflows/update-sitemap.yml" target="_blank" rel="noopener noreferrer">Publicar vitrine</a><a href="/melhores-escolhas.html" target="_blank" rel="noopener noreferrer">Ver página permanente</a></div>';
        form.querySelector('[data-best-title]').value=seeded.bestChoicesTitle;
        form.hidden=false;loadButton.hidden=true;showPicked();refreshOptions();
        status.textContent='Seleção carregada. Depois de salvar, use Publicar vitrine. Retirar aqui não exclui o cadastro.';
        form.querySelector('[data-best-search]').addEventListener('input',refreshOptions);
        form.querySelector('[data-best-category]').addEventListener('change',refreshOptions);
        form.querySelector('[data-best-add]').addEventListener('click',()=>{
          const id=form.querySelector('[data-best-product]').value;
          if(!id)return;
          if(selectedIds.length>=api.MAX_PRODUCTS){status.textContent='Limite de '+api.MAX_PRODUCTS+' produtos. Retire um destaque antes de adicionar outro.';return;}
          selectedIds.push(id);showPicked();refreshOptions();
        });
        form.querySelector('[data-best-picked]').addEventListener('click',event=>{
          const button=event.target.closest('button');if(!button||pending)return;
          const id=button.dataset.bestRemove||button.dataset.bestUp||button.dataset.bestDown,index=selectedIds.indexOf(id);
          if(index<0)return;
          if(button.dataset.bestRemove)selectedIds.splice(index,1);
          else {const target=index+(button.dataset.bestUp?-1:1);if(target>=0&&target<selectedIds.length)[selectedIds[index],selectedIds[target]]=[selectedIds[target],selectedIds[index]];}
          showPicked();refreshOptions();
        });
        form.querySelector('[data-best-guides]').addEventListener('change',event=>{
          const checked=[...form.querySelectorAll('[data-best-guide]:checked')];
          if(checked.length>api.MAX_GUIDES){event.target.checked=false;status.textContent='Escolha até '+api.MAX_GUIDES+' rankings.';return;}
          // Preserve chosen order; newly checked guide goes last.
          const urls=checked.map(input=>input.value);
          selectedUrls=[...selectedUrls.filter(url=>urls.includes(url)),...urls.filter(url=>!selectedUrls.includes(url))];
        });
        form.querySelector('[data-best-suggest]').addEventListener('click',()=>{
          const chosen=selectedIds.map(id=>productById.get(id)).filter(Boolean), categories=[...new Set(chosen.map(p=>p.categoria))];
          const candidate=categories.length===1 ? 'Melhores escolhas de '+(categoryNames.get(categories[0])||categories[0])+': compare produtos' : api.DEFAULT_TITLE;
          const check=window.RDCPromotionTitle.checkChoices(candidate,chosen);
          setDraftTitle(check.valid?check.title:api.DEFAULT_TITLE);
        });
        form.querySelector('[data-best-save]').addEventListener('click',async()=>{
          if(pending)return;
          const chosen=selectedIds.map(id=>productById.get(id)).filter(Boolean),check=window.RDCPromotionTitle.checkChoices(form.querySelector('[data-best-title]').value,chosen.map(p=>{const price=api.priceState(p,priceStatuses[String(p.id)]);return {...p,preco:price.confirmed?price.value:0};}));
          if(!check.valid){status.textContent=check.reason;return;}
          if(selectedIds.length>api.MAX_PRODUCTS||selectedUrls.length>api.MAX_GUIDES){status.textContent='Seleção acima do limite. Revise antes de salvar.';return;}
          pending=true;form.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
          status.textContent='Salvando somente a seleção permanente…';
          try {
            await saveConfig({bestChoicesTitle:check.title,bestChoicesProductIds:[...selectedIds],bestChoicesGuideUrls:[...selectedUrls]});
            status.textContent='✓ Melhores escolhas salvas. Use Publicar vitrine para atualizar o início e a página permanente. A conferência diária continua igual.';
          } catch(error){status.textContent='Não foi possível salvar. Sua seleção permanece nesta tela. Confira a sessão administrativa.';console.warn(error);}
          finally{pending=false;form.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);showPicked();}
        });
      } catch(error){status.textContent='Não foi possível carregar a seleção. Confira seu login e tente novamente. Nenhum cadastro foi alterado.';console.warn(error);}
      finally{loadButton.disabled=false;}
    });
  }
  window.RDCBestChoicesAdmin={mount};
})();
