import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {guidance} from '../local-purchase-guidance.mjs';
import {matchesPopularAnalysis,popularById,registeredOfferUrl} from '../popular-analysis.mjs';

// Exact published set in 0388c835a; no count-based tolerance for missing IDs.
const baseline=`2V7q6nC2mg54DN9anaYi 2e2m7sDdRyGHq1Tzj8ra 31Lco0eFCDaomsks3iM3 35hImqo3QJm6moaV4OzO 37zRkLVqUxzOjxBLGhO1 48oRcQNlH00KgNLHkvsG 5MGE98tYssH9nEfBeHoW 7TeZ4aAirqbiu3TNCsug 9P123IBTTYnSCMilPvXB 9Y8FuG1gZwVywVcUHPCg AC8pOvLAO9VLZSUhfYfh ARscPKCMZs3D8k22qltl AhbvEgzfMuC19ltrB2WN AweCTxq7vwVQ7VmN4IIg CCnmlZjBf8P0nhSyHOmm DNqszoYPu5LLhotuYNKp EmrdwlcDgCCM5suoz8dB FWTjfbbohQT5qtJGYDBC FlqPY3yHJ2xPoNgnhSTE Gcz9OSyGgHGMKYfG87IS GjHJtzdsIhbmSINvhPeX H3AOP8Gxqhtn1TcPX2Ug HJcpaZe94VZRnomC2hH1 IJvxoOY9DmdDPOXo8ZQ3 InsaA7npZ9l5Qf6jByiC LASwiEy13CerUN6q3pKn LUsq533hX6lTuHwnZbhz M9arBHEFyVVMelHK70ml MBhoRb0kSLsHrhutbTLN MCdK7VlagX4qYFEKn6D9 N1cKmru7WcRrMBSj4ut7 N3JYVELP3Zqr7KuZYA3n NQAtVQKwZQtKxXtEn21Q NUNROG3VOfMVViIW5Rtk Ng9qQNFdPCPMTgUYzfEJ O6e0R2WtiZfyyf2MJe5Y OJulxennkkhusiTWA3Wt PfU3x9udsDbmj7DXjaCk TaSttysuiLO2i5Rrb9hV UNQtBcYJ9obcCPWURmeq UkgpEmnU2nSDUmOujW6W UlgA45nNx2rsEykMbv67 UnTwhXqatX5MyoPnl6DN UvxFn4gfaexb8TvcaT5e VaxspecNzGrFQjieZlq0 Wny29umvm2bXCrY9WGqg XDnd73z0ZIkihILVyQhX XXf1jGItNH4xwlZ136z3 YKSSWNPjLAaUeRSLtVWT YuOWci2UixF5GuQE6IYS ZVVdy8TuP0yW0XNIyiEA a77W30LAOCEPjWdkcAlU asTGBkjkQIZ4mhlc7cxX b052WcTAD3j2UDZHQiXY c3K3tq0esVOpmKeSLd9a c9hb1oe40g3K1dP4dAsy cq6GYICiBnjXrygHzhaO dMbluI9x5kQ0Gwxg8fOU fOI4O124KZd2vLCx8Fmj fOQZ2dyrpaoVIulwTufz gmzJCKnbLsVLIZilQGSe hokaCwafFsMcmt9QPBdX huCYMmOsGPKJ8jOiJ1gR hvEYsBQVyORk8vWbQCNU i1ii8KV1IYFAeAN3SPWH iEXAHv7Lvrd0qvzDXiMA jXr2Y2GPpfN57sjqnpfV kfLnRJzsg88rUfJxMtb6 lqUgNmaegZ1hAiP3iMOU mWdbAKSL36ZpIPwUTbdv mlMLB2062519916 mlMLB4801704305 mlMLB4952988337 mlMLB6907306094 mudVRd1YUQgKwHRcq3iD nsOTlMwVIdo8dNOdpShY oE4gHinZ6CfelSwfLDWk oO9KBr39gclvEu1LfKEj oVBbvfcldF36EbyYex8y pvXy1mkDwgkYeeGFQoUd q4XshIAfttQBQ9Bwz7uB qRN6SoGfO6PrwR2rj96v qZUWO8WSrcOKWVrAqTW7 rcwXY2aQWUN6dbCVzvsB sMCnNBstxTrJqaF6jp2O tKPMnMHGe8qlcFn4nNdC tvmAXcLVslrks9nZlnoa u3QrSb6J4YcZTM5ehgRb uIZQISdVd0NEyClG29Qv uN0To7b1oG7xjWib5gLN ucknzxk5UJWl0GnOXadP vMno2u6iDC5eZJug2sOH w7DR6QTHjF5FdGZyQTYX wyofwkDoOxUtpmtG9uhf xdMGqRvHv2lJ95LaBG9F yKB6RcYlSxOOCG31HXN2 yxqaNbV9fYlB5zQKWLqj zLqKcRRYNyzrP6t1Erhh`.split(' ');
const replacements={
 b052WcTAD3j2UDZHQiXY:'MLB5919534142',
 FlqPY3yHJ2xPoNgnhSTE:'MLB5879981504',
 EmrdwlcDgCCM5suoz8dB:'MLB5275428302',
 NQAtVQKwZQtKxXtEn21Q:'MLB6219822500',
 UNQtBcYJ9obcCPWURmeq:'MLB4841993187',
};
const paused='H3AOP8Gxqhtn1TcPX2Ug';
const page=id=>readFile(new URL('../../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');
export function articleName(html){
 return [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(([,s])=>{const x=JSON.parse(s);return x['@graph']||[x];}).find(x=>x['@type']==='Article'&&x.about?.name)?.about.name;
}

export function assertReplacementGuidance(id,html,title){
 if(!Object.hasOwn(replacements,id))return false;
 const review=popularById.get(id),url=registeredOfferUrl(html);
 if(matchesPopularAnalysis(review,title,url))return false;
 assert.ok(matchesPopularAnalysis({...review,expectedListing:replacements[id]},title,url),id+': oferta substituta inesperada');
 assert.equal(html.split('data-local-purchase-guidance="'+id+'"').length,2,id);
 assert.ok(html.includes(guidance[id]),id);
 assert.doesNotMatch(html,/data-reviewed-depth=|<!-- visibility-editorial:start -->/,id);
 return true;
}

export async function assertReviewedCoverage(catalogue){
 const found=new Set(catalogue.products.filter(p=>p.decisionBrief?.reviewed).map(p=>p.id));
 const expected=new Set(baseline);
 for(const id of Object.keys(replacements)){
  const product=catalogue.products.find(p=>p.id===id);
  assert.ok(product,id+': ficha substituta ausente');
  if(assertReplacementGuidance(id,await page(id),product.title))expected.delete(id);
 }
 const html=await page(paused);
 if(/<meta name="rdc-paused-product" content="true">/.test(html)){
  assert.ok(!catalogue.products.some(p=>p.id===paused),'luminária em pausa no catálogo público');
  assert.doesNotMatch(html,/data-reviewed-depth=|id=["']affiliate-offer["']/);
  expected.delete(paused);
 }
 assert.deepEqual([...found].sort(),[...expected].sort());
}
