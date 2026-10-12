import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSiteConfig,decodeConfigFields,publicWeeklyComparison} from './public-site-config.mjs';
test('configuração publicada preserva vídeos, tema e título sem campos privados',()=>{
 const old={promotionSeoTitle:'Ofertas do dia',youtubeShowcaseEnabled:true,youtubeShowcaseLinks:['https://youtu.be/example'],token:'private'};
 const current={youtubeShowcaseEnabled:false,youtubeShowcaseItems:[{videoUrl:'https://youtu.be/example',productUrl:'/produto/a.html',internal:'secret'}],email:'admin@example.test'};
 const result=publicSiteConfig(old,current,{giftGuideTitle_dia_das_criancas:'Presentes até R$ 100',preco:10},'2026-10-04T12:00:00Z');
 assert.equal(result.youtubeShowcaseEnabled,false);
 assert.equal(result.promotionSeoTitle,old.promotionSeoTitle);
 assert.equal(result.giftGuideTitle_dia_das_criancas,'Presentes até R$ 100');
 assert.deepEqual(result.youtubeShowcaseItems,[{youtubeUrl:'https://youtu.be/example',productUrl:'/produto/a.html'}]);
 for(const field of ['email','token','preco'])assert.equal(field in result,false);
 assert.equal(result.schemaVersion,2);
});
test('decodificação inclui listas e mapas do Firestore e false explícito',()=>{
 const result=decodeConfigFields({youtubeShowcaseEnabled:{booleanValue:false},youtubeShowcaseItems:{arrayValue:{values:[{mapValue:{fields:{videoUrl:{stringValue:'video'},productUrl:{stringValue:'product'}}}}]}}});
 assert.deepEqual(result,{youtubeShowcaseEnabled:false,youtubeShowcaseItems:[{videoUrl:'video',productUrl:'product'}]});
});
test('conteúdo privado aninhado em campo de apresentação bloqueia publicação',()=>{
 assert.throws(()=>publicSiteConfig({}, {promotionSeoTitle:{token:'privado'}}),/inválida/);
 assert.throws(()=>publicSiteConfig({}, {youtubeShowcaseLinks:[{token:'privado'}]}),/inválido/);
});

test('comparativo usa allowlist recursiva sem tokens, links de afiliado ou configuração privada',()=>{
 const input={publicado:true,semana:'2026-10-12',titulo:'Comparativo',token:'private',adminEmail:'private',produtos:[{id:'product',titulo:'Produto',preco:99,linkAfiliado:'secret',pros:['Fato'],criterios:{evidencia:7,apiKey:'secret'},analiseHumana:{veredito:'Ficha',secret:'private'}}],analiseIA:{metodo:'ficha',token:'private'},metodologia:{evidencia:0.2,private:'secret'}};
 const result=publicSiteConfig({}, {weeklyComparison:input}).weeklyComparison;
 assert.equal(result.titulo,'Comparativo');
 assert.equal(result.produtos[0].preco,99);
 assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.equal(JSON.stringify(result).includes('private'),false);
 assert.deepEqual(result.produtos[0].criterios,{evidencia:7});
 assert.deepEqual(result.metodologia,{evidencia:0.2});
 assert.throws(()=>publicWeeklyComparison({produtos:[{id:'a/b'}]}),/Produto inválido/);
 assert.throws(()=>publicSiteConfig({}, {weeklyComparison:['private']}),/inválido/);
});
