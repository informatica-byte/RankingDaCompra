import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const source=await readFile('growth-tools.js','utf8');
test('tema informativo respeita seleção, período, desligamento e prévia sem Firestore',()=>{
 const segment=source.slice(source.indexOf('  function configuredThemeId('),source.indexOf('  function renderSeasonalTheme('));
 const context={URLSearchParams,location:{search:''},SEASONAL_THEMES:{'black-friday':{},natal:{}},todayKey:()=> '2026-11-04',automaticThemeId:()=> 'natal'};vm.createContext(context);vm.runInContext(segment+';this.choose=configuredThemeId',context);
 assert.equal(context.choose({seasonalThemeMode:'manual',seasonalThemeId:'black-friday'}),'black-friday');
 assert.equal(context.choose({seasonalThemeMode:'off',seasonalThemeId:'black-friday'}),'');
 assert.equal(context.choose({seasonalThemeMode:'manual',seasonalThemeId:'black-friday',seasonalThemeStart:'2026-11-15'}),'');
 assert.equal(context.choose({seasonalThemeMode:'manual',seasonalThemeId:'black-friday',seasonalThemeEnd:'2026-11-03'}),'');
 assert.equal(context.choose({seasonalThemeMode:'auto'}),'natal');
 context.location.search='?tema-preview=black-friday';assert.equal(context.choose({seasonalThemeMode:'off'}),'black-friday');
 const render=source.slice(source.indexOf('  function renderSeasonalTheme('),source.indexOf('  function updateMascotTheme('));
 assert.doesNotMatch(render,/RDCInformational\?\.enabled\)return|\.collection\(|\.get\(/);assert.match(render,/Compare características, vantagens e limitações/);
});
