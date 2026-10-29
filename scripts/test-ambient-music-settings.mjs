import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import settings from '../ambient-music-settings.js';
import {publicSiteConfig} from './public-site-config.mjs';
const track={name:'Trilha própria',url:'https://audio.example.org/faixa.mp3',credit:'Autor responsável',rights:'own',licenseUrl:''};
const files={version:1,kind:'files',rightsConfirmed:true,tracks:[track]};
test('sem configuração conserva a melodia original; os três presets são locais',()=>{
 assert.equal(settings.normalize().preset,'suave');assert.equal(settings.PRESETS.length,3);
 for(const preset of settings.PRESETS){assert.ok(preset.chords.flat().every(Number.isFinite));assert.ok(preset.melody.every(Number.isFinite));assert.equal(settings.normalize({kind:'generated',preset:preset.id},{strict:true}).preset,preset.id);}
 assert.throws(()=>settings.normalize({kind:'generated',preset:'externa'},{strict:true}));
});
test('arquivos exigem declaração de direitos, créditos e no máximo seis itens distintos',()=>{
 assert.equal(settings.normalize(files,{strict:true}).tracks[0].url,track.url);
 for(const input of [{...files,rightsConfirmed:false},{...files,tracks:[]},{...files,tracks:[track,track]},{...files,tracks:[{...track,credit:''}]},{...files,tracks:[{...track,rights:'licensed'}]},{...files,tracks:Array(7).fill(track)}])assert.throws(()=>settings.normalize(input,{strict:true}));
 const licensed={...files,tracks:[{...track,rights:'licensed',licenseUrl:'https://example.org/licenca'}]};
 assert.equal(settings.normalize(licensed,{strict:true}).tracks[0].rights,'licensed');
});
test('escolher uma melodia gerada preserva a lista de arquivos já validada, sem tocá-la',()=>{
 const value=settings.normalize({...files,kind:'generated',preset:'calma'},{strict:true});
 assert.equal(value.kind,'generated');assert.equal(value.preset,'calma');assert.deepEqual(value.tracks,[track]);
 assert.deepEqual(settings.normalize({...value,kind:'files'},{strict:true}).tracks,[track]);
});
test('endereços não aceitam plataformas, credenciais, acesso privado ou links temporários',()=>{
 for(const url of ['http://example.org/a.mp3','https://user:secret@example.org/a.mp3','https://example.org/a.mp3?token=secret','https://example.org/a.mp3#secret','https://example.org:444/a.mp3','https://127.0.0.1/a.mp3','https://[::1]/a.mp3','https://intranet.local/a.mp3','javascript:alert(1)','data:audio/mp3,AAAA','https://youtube.com/a.mp3','https://youtube.com/watch','https://example.org/pagina.html'])assert.throws(()=>settings.audioUrl(url),url);
});
test('publicação permite só os campos conhecidos e bloqueia configuração inválida',()=>{
 const value=publicSiteConfig({}, {ambientMusic:{...files,token:'privado',tracks:[{...track,password:'segredo'}]},password:'segredo'});
 assert.deepEqual(value.ambientMusic,settings.normalize(files,{strict:true}));assert.doesNotMatch(JSON.stringify(value),/privado|segredo|token|password/);
 assert.throws(()=>publicSiteConfig({}, {ambientMusic:{...files,rightsConfirmed:false}}));
 assert.deepEqual(settings.normalize({kind:'files',rightsConfirmed:false}),settings.defaults());
});
test('carregamento lê apenas o arquivo público uma vez e falhas preservam a melodia original',async()=>{
 const source=await readFile(new URL('../ambient-music-settings.js',import.meta.url),'utf8');let requests=0;
 const browser={URL,window:null,setTimeout,clearTimeout};browser.window=browser;browser.RDCPublicData={json:async path=>{assert.equal(path,'/site-config.json');requests++;return {ambientMusic:files};}};
 vm.runInNewContext(source,browser);const api=browser.RDCAmbientMusicSettings;
 const [a,b]=await Promise.all([api.load(),api.load()]);assert.equal(requests,1);assert.equal(a.kind,'files');assert.deepEqual(a,b);
 assert.doesNotMatch(source,/firestore|firebase|gtag|Authorization|Bearer|localStorage|sessionStorage/i);
 const failed={URL,setTimeout,clearTimeout};failed.window=failed;failed.RDCPublicData={json:async()=>{throw Error('Offline');}};
 vm.runInNewContext(source,failed);const fallback=await failed.RDCAmbientMusicSettings.load();assert.equal(fallback.kind,'generated');assert.equal(fallback.unavailable,true);
});
test('dashboard usa a leitura de configuração já existente e salva somente ambientMusic',async()=>{
 const admin=await readFile(new URL('../ambient-music-admin.js',import.meta.url),'utf8'),growth=await readFile(new URL('../growth-tools.js',import.meta.url),'utf8');
 assert.match(admin,/save\(\{ambientMusic:next\}\)/);assert.doesNotMatch(admin,/firebase|firestore|\.collection\(|fetch\(|gtag\(/);
 assert.match(growth,/RDCAmbientMusicAdmin\?\.mount\([^]*?\{config,/);
 assert.match(admin,/preload="none"/);assert.match(admin,/declaração não substitui/);
});
