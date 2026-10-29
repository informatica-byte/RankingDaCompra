import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import imageData from '../product-image-data.js';
import {materializeLocalProductImages} from './local-product-images.mjs';
import {decodeConfigFields} from './public-site-config.mjs';
// Header fixture for structural/hash tests. Browser QA separately encodes and
// decodes a real canvas-generated JPEG end to end.
const bytes=Uint8Array.from([255,216,255,192,0,11,8,0,100,0,120,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,2,3,4,255,217]);
async function fixture(id='produto-teste'){
 const hash=await imageData.digest(bytes);return {version:1,productId:id,mime:'image/jpeg',hash,data:Buffer.from(bytes).toString('base64'),bytes:bytes.length,width:120,height:100};
}
test('fila contém só JPEG otimizado e valida hash, tamanho, dimensões e vínculo ao cadastro',async()=>{
 const value=await fixture(),valid=await imageData.validate(value,value.productId);assert.equal(valid.url,imageData.urlFor(value.productId,value.hash));
 for(const bad of [{...value,hash:'0'.repeat(64)},{...value,width:1},{...value,bytes:10000},{...value,productId:'outro'},{...value,mime:'image/svg+xml'},{...value,data:'<svg/>'}])await assert.rejects(imageData.validate(bad,value.productId));
 assert.throws(()=>imageData.fileName('../segredo',value.hash));assert.throws(()=>imageData.queueId('produto/com/barra'));
});
test('URLs locais não aceitam outro cadastro, credenciais ou parâmetros de acesso',async()=>{
 const value=await fixture(),url=imageData.urlFor(value.productId,value.hash);assert.equal(imageData.descriptor({id:value.productId,foto:url}).hash,value.hash);
 assert.equal(imageData.descriptor({id:value.productId,foto:'https://http2.mlstatic.com/foto.jpg'}),null);
 assert.throws(()=>imageData.descriptor({id:'outro',foto:url}));assert.throws(()=>imageData.descriptor({id:value.productId,foto:url+'?token=segredo'}));
});
test('validação aceita os inteiros retornados pelo Firestore REST sem aceitar coerções inseguras',async()=>{
 const value=await fixture(),fields=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,typeof item==='number'?{integerValue:String(item)}:{stringValue:item}]));
 const decoded=decodeConfigFields(fields);assert.equal((await imageData.validate(decoded,value.productId)).hash,value.hash);
 for(const version of [true,'1.0','1e0',null,{},''])await assert.rejects(imageData.validate({...value,version},value.productId));
});
test('validação rejeita metadados EXIF, tamanho excessivo e imagem sem quadro',()=>{
 assert.throws(()=>imageData.dimensions(new Uint8Array(imageData.MAX_BYTES+1)));
 const exif=Uint8Array.from([255,216,255,225,0,4,1,2,...bytes.slice(2)]);assert.throws(()=>imageData.dimensions(exif),/metadados/);
 const giant=bytes.slice();giant[7]=10;assert.throws(()=>imageData.dimensions(giant),/Dimensões/);
});
test('publicador escreve o arquivo no site, consulta a fila uma vez e reutiliza a cópia íntegra',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rdc-local-photo-')),directory=join(root,'produto/imagens'),value=await fixture();let reads=0;
 try{
  const product={id:value.productId,foto:imageData.urlFor(value.productId,value.hash),preco:'99,90',linkAfiliado:'https://meli.la/preservado'},before=JSON.stringify(product);
  const reader=async item=>{assert.equal(item.queueId,imageData.queueId(product.id));reads++;return value;};
  const result=await materializeLocalProductImages([product,product],directory,reader);assert.equal(result.size,1);assert.equal(reads,1);assert.equal(JSON.stringify(product),before);
  const path=join(directory,imageData.fileName(product.id,value.hash));assert.deepEqual(new Uint8Array(await readFile(path)),bytes);
  await materializeLocalProductImages([product],directory,()=>{throw Error('Não reler fila para imagem já publicada.');});assert.equal(reads,1);
  await writeFile(path,'arquivo adulterado');await assert.rejects(materializeLocalProductImages([product],directory,reader),/validação/);
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});}
});
test('fila ausente ou trocada bloqueia a publicação sem fabricar foto ou alterar produto',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rdc-photo-missing-')),value=await fixture(),product={id:value.productId,foto:imageData.urlFor(value.productId,value.hash)},before=JSON.stringify(product);
 try{
  await assert.rejects(materializeLocalProductImages([product],root,async()=>null),/pendente não encontrada/);
  await assert.rejects(materializeLocalProductImages([product],root,async()=>({...value,hash:'1'.repeat(64)})),/integridade/);
  await assert.rejects(access(join(root,imageData.fileName(product.id,value.hash))),{code:'ENOENT'});assert.equal(JSON.stringify(product),before);
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});}
});
test('os dois painéis gravam foto e produto na mesma transação sem usar Firebase Storage',async()=>{
 for(const file of ['dashboard.html','painel-celular.html']){
  const html=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.match(html,/product-image-picker\.js/);assert.match(html,/queueRecord\(imagemLocal/);assert.match(html,/transaction\.set\([^\n]+queueRecord/);
  assert.doesNotMatch(html,/firebase\.storage\(|uploadBytes\(/);
 }
 const generator=await readFile(new URL('./generate-sitemap.mjs',import.meta.url),'utf8');assert.ok(generator.indexOf('await materializeLocalProductImages')<generator.indexOf('let socialImages ='));
});
