import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export async function buildLinkAuditBot(root=new URL('..',import.meta.url),writeOutput=true){
 const metadata=`// ==UserScript==
// @name         Ranking da Compra - Bot local de preços
// @namespace    https://rankingdacompra.com.br/
// @version      2.5.4
// @description  Somente Mercado Livre: anúncio disponível ou indisponível. Sem Shopee, comparação de produtos ou preços e sem alteração automática de links.
// @match        https://rankingdacompra.com.br/dashboard.html*
// @match        https://rankingdacompra.com.br/painel-celular.html*
// @match        https://*.mercadolivre.com.br/*
// @match        https://mercadolivre.com.br/*
// @match        https://meli.la/*
// @match        https://www.meli.la/*
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_getTab
// @grant        GM_saveTab
// @updateURL    https://rankingdacompra.com.br/bot-links.user.js
// @downloadURL  https://rankingdacompra.com.br/bot-links.user.js
// @run-at       document-start
// @noframes
// ==/UserScript==
`;
 const parts=await Promise.all(['affiliate-link-audit.js','affiliate-link-bot.js'].map(file=>readFile(new URL(file,root),'utf8')));
 const boot=`\nRDCAffiliateLinkBot.install({root:unsafeWindow,document,location,get:(key)=>GM_getValue(key,null),set:(key,value)=>GM_setValue(key,value),listen:(key,fn)=>GM_addValueChangeListener(key,fn),unlisten:id=>GM_removeValueChangeListener(id),getTab:fn=>GM_getTab(fn),saveTab:(tab,fn)=>GM_saveTab(tab,fn)});\n`;
 const output=metadata+'\n'+parts.map(p=>p.replace(/\r\n/g,'\n')).join('\n')+boot;if(writeOutput)await writeFile(new URL('bot-links.user.js',root),output);return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await buildLinkAuditBot();
