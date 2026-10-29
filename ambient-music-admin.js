(function(root){
 'use strict';
 const settings=root.RDCAmbientMusicSettings;
 const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(container,{config={},save}){
  if(!container||!settings||container.dataset.musicMounted)return;
  container.dataset.musicMounted='true';
  const style=document.createElement('style');
  style.textContent='[data-music-mounted]{max-width:100%;min-width:0}[data-music-mounted] label{display:block;margin:10px 0}[data-music-mounted] input:not([type=checkbox]),[data-music-mounted] select{box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:44px;font:inherit}[data-music-mounted] input[type=checkbox]{width:auto!important;min-height:0;margin-right:8px}[data-music-mounted] button{min-height:44px;white-space:normal}[data-music-mounted] [hidden]{display:none!important}[data-music-mounted] p{overflow-wrap:anywhere}';
  container.appendChild(style);
  container.insertAdjacentHTML('beforeend',`<h2>♫ Música ambiente do site</h2>
   <p>Escolha a trilha oferecida aos visitantes. Ela sempre começa desligada; cada pessoa decide se quer ouvir e controla o volume.</p>
   <label for="ambient-kind">Tipo de música</label><select id="ambient-kind"><option value="generated">Melodias geradas no próprio site</option><option value="files">Meus arquivos próprios ou licenciados</option></select>
   <div data-generated><label for="ambient-preset">Melodia</label><select id="ambient-preset">${settings.PRESETS.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><p>Instrumentais sintetizados no navegador. Não usam gravações de plataformas externas.</p><button type="button" data-preview-generated>Ouvir prévia da melodia</button></div>
   <div data-files hidden><p>Cadastre até seis arquivos. A sequência toca na ordem abaixo, somente após o visitante ativar. Os áudios não são enviados ao Firebase.</p><div data-tracks></div><button type="button" data-add-track>+ Adicionar faixa</button>
   <p>Use links diretos, públicos e permanentes (MP3, M4A, OGG, WAV ou AAC). Não cole contratos, senhas, links temporários ou credenciais. Créditos e endereço da licença serão públicos. O tamanho e a hospedagem dos arquivos podem ter consumo próprio.</p>
   <label><input type="checkbox" data-rights-confirmed> Confirmo que possuo os direitos ou uma licença que permite usar estas faixas neste site comercial, e que seguirei as condições de atribuição. Esta declaração não substitui a conferência da licença.</label></div>
   <div class="growth-row"><button type="button" data-stop-preview>Parar prévia</button><button type="button" data-save-music>Salvar música do site</button><a href="https://github.com/informatica-byte/RankingDaCompra/actions/workflows/update-sitemap.yml" target="_blank" rel="noopener noreferrer">Publicar as configurações salvas</a></div>
   <p data-music-status role="status" aria-live="polite"></p>`);
  const kind=container.querySelector('#ambient-kind'),preset=container.querySelector('#ambient-preset'),list=container.querySelector('[data-tracks]'),confirmed=container.querySelector('[data-rights-confirmed]'),status=container.querySelector('[data-music-status]');
  let current=settings.normalize(config.ambientMusic);const previews=new Set();
  let previewContext=null,previewTimer=null;
  const stop=()=>{
   if(previewTimer!==null){root.clearTimeout(previewTimer);previewTimer=null;}
   if(previewContext){const previous=previewContext;previewContext=null;void previous.close().catch(()=>{});}
   for(const audio of previews){audio.pause();audio.removeAttribute('src');audio.load();}previews.clear();
  };
  container.querySelector('[data-stop-preview]').addEventListener('click',()=>{stop();status.textContent='Prévia encerrada. Nenhuma configuração foi alterada.';});
  container.querySelector('[data-preview-generated]').addEventListener('click',async()=>{
   stop();try{
    const AudioContextClass=root.AudioContext||root.webkitAudioContext;if(!AudioContextClass)throw Error('Áudio indisponível');
    const context=previewContext=new AudioContextClass(),pattern=settings.PRESETS.find(p=>p.id===preset.value);
    await context.resume();if(previewContext!==context)return;
    pattern.chords.forEach((chord,index)=>chord.forEach(note=>{
     const osc=context.createOscillator(),gain=context.createGain(),at=context.currentTime+.05+index*2;
     osc.type='sine';osc.frequency.value=440*Math.pow(2,(note-69)/12);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.025,at+.3);gain.gain.exponentialRampToValueAtTime(.0001,at+2.8);
     osc.connect(gain);gain.connect(context.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+2.9);
    }));
    previewTimer=root.setTimeout(stop,9200);status.textContent='Prévia curta da melodia. Nenhuma configuração foi salva.';
   }catch{stop();status.textContent='Não foi possível iniciar a prévia neste navegador.';}
  });
  function add(track={}){
   if(list.children.length>=6)return;
   const row=document.createElement('fieldset');row.style.cssText='margin:12px 0;padding:12px;min-width:0;border:1px solid #c8d9ce;border-radius:10px';
   row.innerHTML=`<legend>Faixa</legend><label>Nome da música<input data-name maxlength="80" value="${esc(track.name)}"></label><label>Endereço HTTPS do arquivo de áudio<input data-url type="url" value="${esc(track.url)}" placeholder="https://seu-site.com.br/audio/musica.mp3"></label><label>Autor / créditos públicos<input data-credit maxlength="180" value="${esc(track.credit)}"></label><label>Permissão de uso<select data-rights><option value="own">Faixa própria — tenho os direitos</option><option value="licensed">Faixa licenciada para este uso</option></select></label><label>Página pública com os termos da licença<input data-license type="url" value="${esc(track.licenseUrl)}" placeholder="Obrigatória para faixas licenciadas"></label><div class="growth-row"><button type="button" data-preview>Ouvir prévia</button><button type="button" data-remove>Remover da lista</button></div><audio controls preload="none" crossorigin="anonymous" hidden style="width:100%;max-width:100%"></audio>`;
   row.querySelector('[data-rights]').value=track.rights||'own';
   row.querySelector('[data-remove]').addEventListener('click',()=>{stop();row.remove();});
   row.querySelector('[data-preview]').addEventListener('click',async()=>{
    stop();try{const url=settings.audioUrl(row.querySelector('[data-url]').value),audio=row.querySelector('audio');audio.src=url;audio.hidden=false;previews.add(audio);await audio.play();status.textContent='Prévia privada no painel. Nenhuma configuração foi salva.';}catch{status.textContent='Não foi possível ouvir. Confira o endereço direto, o formato e a permissão de acesso do arquivo.';}
   });list.appendChild(row);
  }
  const show=()=>{stop();container.querySelector('[data-generated]').hidden=kind.value!=='generated';container.querySelector('[data-files]').hidden=kind.value!=='files';};
  kind.value=current.kind;preset.value=current.preset;confirmed.checked=current.rightsConfirmed===true;
  (current.tracks.length?current.tracks:[{}]).forEach(add);show();
  kind.addEventListener('change',show);container.querySelector('[data-add-track]').addEventListener('click',()=>{if(list.children.length>=6){status.textContent='O limite é de seis faixas.';return;}add();});
  container.querySelector('[data-save-music]').addEventListener('click',async event=>{
   const button=event.currentTarget;let next;
   try{next=settings.normalize({kind:kind.value,preset:preset.value,rightsConfirmed:kind.value==='generated'?current.rightsConfirmed===true:confirmed.checked,tracks:kind.value==='generated'?current.tracks:[...list.children].map(row=>({name:row.querySelector('[data-name]').value,url:row.querySelector('[data-url]').value,credit:row.querySelector('[data-credit]').value,rights:row.querySelector('[data-rights]').value,licenseUrl:row.querySelector('[data-license]').value}))},{strict:true});}
   catch(error){status.textContent=error.message;return;}
   button.disabled=true;stop();
   try{await save({ambientMusic:next});current=next;status.textContent='✓ Configuração salva no painel. Use “Publicar as configurações salvas” para aplicá-la ao site. A música continuará desligada em cada nova entrada.';}
   catch{status.textContent='Não foi possível salvar. Confira sua sessão administrativa; a configuração anterior foi preservada.';}
   finally{button.disabled=false;}
  });
  root.addEventListener('pagehide',stop);
 }
 root.RDCAmbientMusicAdmin={mount};
})(window);
