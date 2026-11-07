import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {distinguishRepeatedProductMetadata} from './public-seo-labels.mjs';

test('metadados repetidos distinguem páginas sem alterar conteúdo ou afiliados',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rdc-meta-'));
 try{
  await mkdir(join(root,'produto'));
  const page=offer=>'<html><head><title>Produto | Ranking da Compra</title><meta name="description" content="Descrição"></head><body><h1>Produto</h1><a id="affiliate-offer" href="https://meli.la/preservar">Loja</a><a href="https://www.mercadolivre.com.br/p/MLB12345678?wid='+offer+'" data-product-source>Origem</a></body></html>';
  for(const id of ['a','b'])await writeFile(join(root,'produto',id+'-20260810-1.html'),page('MLB1234567890'));
  const files=await distinguishRepeatedProductMetadata(root);assert.equal(files.length,2);
  const out=await Promise.all(files.map(f=>readFile(join(root,f),'utf8')));
  assert.notEqual(out[0].match(/<title>(.*?)<\/title>/)[1],out[1].match(/<title>(.*?)<\/title>/)[1]);
  for(const h of out){assert.ok(h.includes('<h1>Produto</h1>'));assert.ok(h.includes('href="https://meli.la/preservar"'));assert.ok(h.includes('Referência:'));}
  assert.deepEqual(await distinguishRepeatedProductMetadata(root),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
