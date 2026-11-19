import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),html=readFileSync(new URL('dashboard.html',root),'utf8'),css=readFileSync(new URL('dashboard-mobile.css',root),'utf8');
test('dashboard carrega melhoria de apresentação sem ocultar controles ou criar lógica',()=>{
 assert.match(html,/dashboard-mobile\.css\?v=20261119-1/);
 assert.doesNotMatch(css,/display\s*:\s*none|visibility\s*:\s*hidden|pointer-events\s*:\s*none|url\(/);
 assert.match(css,/font-size:1rem;min-height:44px/);
 assert.match(css,/min-width: 901px/);assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(html,/Gerar textos com IA para as 3/);
 assert.match(html,/id="btn-central-ia"/);
});
test('ajustes móveis ficam limitados ao painel autenticado e têm foco visível',()=>{
 assert.match(css,/#admin-content input:not/);assert.match(css,/#admin-content label\{font-size:\.875rem/);
 assert.match(css,/#admin-content :is\(input,select,textarea,button,a\):focus-visible/);
 assert.match(css,/@media \(max-width:700px\)/);
});
