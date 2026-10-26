(function(root){
  'use strict';
  // Reviewed identity digests. No prices, credentials or full tracking URLs.
  const TARGETS=Object.freeze([
    ['51cYaPGtvus2ayLrbFwH','Starlink Mini (1/4)','181ec68d0a6c93e7b85fbb760e26305bbad8ee0337eaf8564bf413b0d7dd0ea8'],
    ['6mZ1ahzme9kUH1UdSkJw','Starlink Mini (2/4)','d56d59fecd4dd0992c8e252ca8e68bd444e7ce745bb9d4f823f26dfc9d989f52'],
    ['mlMLB7533453778','Starlink Mini (3/4)','1641b546a21466bf664d0e8c882dffa1bf34a26d33353b731d6f204069190bc7'],
    ['vyd0L1vgWAHSQvJ1p6En','Starlink Mini (4/4)','7618015336748e9dd5ac7bdfbd5b7e63274d8aa1b0273ecd7e805817c4e29205'],
    ['f4GF7ry1ExQ2hUfIdbet','Lenovo 83NS0002BR (1/3)','57d64f71efddc8d5206f15faf90c8925190033cca58de51c3f24a32ed7e9cd08'],
    ['OJulxennkkhusiTWA3Wt','Lenovo 83NS0002BR (2/3)','56f39bd1a39be0ed792e271b57238410c03d593dae28404243504640a476e722'],
    ['XCp2wV9P76JfBz2zuUTX','Lenovo 83NS0002BR (3/3)','c75faa78ffc6d1dd1d19ddea2432d109ab58066d551f0aebd2735b51e660f353'],
    ['elvNcaWSZ5ed34Pmj8SV','Galaxy A36 256 GB (1/4)','94f260fa3c7a42a354f936fb9bc81e1979d7efd1ad23ce00c93d63cd5bd41f10'],
    ['Y2LaqRfUnmllTmesIOpB','Galaxy A36 256 GB (2/4)','5d7819d093b5ade3b7c93f62f4010d5a4ac035e1c8daa1eeeeff695242fec4f6'],
    ['tvmAXcLVslrks9nZlnoa','Galaxy A36 256 GB (3/4)','c56ab05a3ef37cf82f57d4a9279add7bf8c3b5a3260fb56c58fe0ed1a70eb9c0'],
    ['l7Z9wjqB0dHSHYJ6IVMA','Galaxy A36 256 GB (4/4)','5cc67951fc4efefc953a395bf5fb7387c9c0162d0c53bfc342acc475da9c36d2'],
    ['Gcz9OSyGgHGMKYfG87IS','Intelbras iME 360 (1/2)','e94be956fc6f13e779712ceb99ac73d029c63b532bf46db8bb6b06acf40669e4'],
    ['L4YCGgXLxp4E2TdJg5LH','Intelbras iME 360 (2/2)','fa9cdcc7b147b5244b4d492baad90ab91a0f05c92c3ff6d0f0670af98fa0b00e'],
    ['bl7H9O18KchH8c7oHfWk','Philco P32CRB (1/2)','13fcd55773d7220e6751a3578bb0091ea733c52bd3ab370cdcc302fcae752cf8'],
    ['LS2YLo5zNF7RptrFMYgB','Philco P32CRB (2/2)','4852da5dcfc77ab693d32c1cda1e3a5fb2a63eb0dc40e9dfd0b2df2c0a0ca9c0'],
    ['pkxU80EMbnHaYkuHdexW','WAP Robot W90 (1/2)','0b84710adbabb1470bd70906b81ee0a1642aa96ed7391a91c548c9c509283a85'],
    ['2V7q6nC2mg54DN9anaYi','WAP Robot W90 (2/2)','9fa1d8f786f0ec8b7baa5124d9405ad393d64d4dcc736a9773d29c62d5add796'],
    ['Q8DBpY2NmhVcQxfbHhrK','Mondial B-44-B','92ee5cc2a9c0441bc22f1d5246ba7c4506c2067f3a1e6a1d63bfff8d22114bf9'],
    ['1OfMg1pRePuvTqXaLiV6','Mondial B-44-W','b9627a18ea114ea264a6bfc9bdd5202b0e071c143dda787c6e9233119d67b733'],
    ['5bQKU9inL3pq14yE8K4L','soundcore P30i verde','70b63ea97a80d5f726dbacdf94f539684bc824257d84359861ea0cce563c7adb'],
    ['ZVVdy8TuP0yW0XNIyiEA','soundcore P30i preto','3a654a235e8adc3fe5a2aec87a4d41b70eb86f003a73de66dc7c15b64ae0a960']
  ].map(([id,label,digest])=>Object.freeze({id,label,digest})));
  const active=new WeakSet();
  function fail(message){const error=new Error(message);error.code='rdc-reviewed-pause';throw error;}
  async function fingerprint(data){
    const values=[String(data.titulo||'').normalize('NFC').trim(),...['link','linkAfiliado','foto'].map(k=>String(data[k]||'').trim())];
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(values)));
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }
  // Optional manifest is for pure tests. The mounted UI always uses TARGETS.
  async function planPauses(records,manifest=TARGETS){
    if(!Array.isArray(manifest)||manifest.length!==21||new Set(manifest.map(p=>p.id)).size!==21||manifest.some(p=>!TARGETS.some(t=>t.id===p.id)||!/^[a-f0-9]{64}$/.test(p.digest)))fail('Lista de revisão inválida.');
    if(!Array.isArray(records)||records.length!==21||new Set(records.map(p=>p.id)).size!==21)fail('Leitura incompleta dos 21 cadastros.');
    const byId=new Map(records.map(p=>[p.id,p.data])),pauseIds=[],alreadyPausedIds=[];
    for(const target of manifest){
      const data=byId.get(target.id);
      if(!data||typeof data!=='object')fail('Cadastro ausente: '+target.label+'. Nenhum cadastro será recriado.');
      if(await fingerprint(data)!==target.digest)fail('Cadastro alterado desde a revisão: '+target.label+'. A pausa foi bloqueada para não atingir outro produto.');
      (data.conferenciaPausada===true?alreadyPausedIds:pauseIds).push(target.id);
    }
    return {pauseIds,alreadyPausedIds};
  }
  async function commitPause(adapter,manifest=TARGETS){
    if(active.has(adapter))fail('A pausa já está sendo salva.');
    active.add(adapter);
    let acquired=false;
    try{
      const uid=adapter.session();if(!uid)fail('Entre no painel antes de confirmar a pausa.');
      adapter.assertReady(false);acquired=true;adapter.busy?.(true);
      return await adapter.transaction(async transaction=>{
        if(adapter.session()!==uid)fail('A sessão mudou. Entre novamente antes de salvar.');
        adapter.assertReady(true);
        const records=await Promise.all(TARGETS.map(t=>transaction.get(t.id)));
        const plan=await planPauses(records,manifest);
        if(adapter.session()!==uid)fail('A sessão mudou. Nenhuma pausa foi autorizada nesta sessão.');
        adapter.assertReady(true);
        const timestamp=plan.pauseIds.length?adapter.timestamp():null;
        for(const id of plan.pauseIds)transaction.update(id,{conferenciaPausada:true,conferenciaPausadaEm:timestamp});
        return {...plan,session:uid};
      });
    }finally{try{if(acquired)adapter.busy?.(false);}finally{active.delete(adapter);}}
  }
  function mount(container,adapter){
    if(!container)return {refresh(){}};
    const document=container.ownerDocument;
    const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
    const heading=el('h2','⏸ Revisão manual — 21 cadastros');
    const note=el('p','Pausa somente os 21 cadastros da auditoria. Preserva preços, histórico e conferências salvas. Não altera anúncios no Mercado Livre.');
    const prepare=el('button','Pausar os 21 para revisão manual','btn claro');prepare.type='button';prepare.id='revisao-pausa-preparar';
    const review=el('div');review.hidden=true;
    const list=el('ul');list.style.cssText='padding-left:22px;overflow-wrap:anywhere;line-height:1.5';
    for(const target of TARGETS){const item=el('li',target.label);item.append(el('small',' — '+target.id,'mini'));list.append(item);}
    const label=el('label'),check=el('input');check.type='checkbox';check.id='revisao-pausa-confirmacao';label.append(check,document.createTextNode(' Confirmo a pausa destes 21 cadastros para revisão manual.'));
    const confirm=el('button','Confirmar pausa dos 21','btn verde');confirm.type='button';confirm.id='revisao-pausa-confirmar';confirm.disabled=true;
    const cancel=el('button','Cancelar sem salvar','btn claro');cancel.type='button';
    const help=el('p','Ficarão fora da fila diária. A vitrine refletirá a pausa após a próxima publicação validada. Os 30 dias são apenas um aviso: nada será excluído ou reativado automaticamente.','mini');
    review.append(list,label,confirm,cancel,help);
    const status=el('p','Nada foi pausado por este botão. A leitura no servidor só acontece após sua confirmação.','mini');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    container.append(heading,note,prepare,review,status);
    let uid=null,busy=false,lastSession=adapter.session();
    function refresh(){const current=adapter.session();if(current!==lastSession){uid=null;check.checked=false;review.hidden=true;status.textContent='Sessão alterada. Prepare a revisão novamente.';lastSession=current;}prepare.disabled=busy||!current;check.disabled=busy;cancel.disabled=busy;confirm.disabled=busy||!check.checked||!uid||current!==uid;}
    const errorText=e=>e?.code==='rdc-reviewed-pause'?e.message:'Não foi possível confirmar a pausa no servidor. Confira a sessão e a lista antes de tentar novamente. Nenhum preço é modificado por este botão.';
    const writer={...adapter,busy(value){busy=value;adapter.busy?.(value);refresh();}};
    prepare.addEventListener('click',()=>{if(busy)return;try{adapter.assertReady(false);uid=adapter.session();if(!uid)fail('Entre no painel.');review.hidden=false;check.checked=false;status.textContent='Confira a lista e marque a confirmação. Nenhuma consulta ou gravação foi feita.';refresh();}catch(e){status.textContent=errorText(e);}});
    check.addEventListener('change',refresh);
    cancel.addEventListener('click',()=>{if(busy)return;uid=null;check.checked=false;review.hidden=true;status.textContent='Cancelado. Nenhuma pausa foi solicitada.';refresh();});
    confirm.addEventListener('click',async()=>{
      if(busy||!check.checked||!uid||adapter.session()!==uid)return;
      status.textContent='Validando os 21 cadastros e salvando a pausa sem alterar preços...';
      try{const result=await commitPause(writer);if(adapter.session()!==result.session)return;
        let warning='';try{adapter.committed?.(result);}catch{warning=' Recarregue o painel para atualizar a lista; não repita a conferência.';}
        uid=null;check.checked=false;review.hidden=true;
        status.textContent='✅ Os 21 cadastros estão pausados: '+result.pauseIds.length+' pausados agora e '+result.alreadyPausedIds.length+' já estavam pausados. Preços e histórico preservados. Use “Anúncios pausados” para revisar; carregue a fila se ainda não estiver aberta.'+warning;
      }catch(e){status.textContent=errorText(e);}finally{refresh();}
    });
    refresh();return {refresh};
  }
  const api={TARGETS,fingerprint,planPauses,commitPause,mount};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RDCPendingReviewPause=api;
})(typeof window!=='undefined'?window:null);
