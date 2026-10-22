import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root=new URL('./',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('fonts/sources.json',root),'utf8'));
const css=readFileSync(new URL('bundled-fonts.css',root),'utf8');
const embedded=[...css.matchAll(/data:font\/(?:otf|ttf);base64,([A-Za-z0-9+/=]+)/g)];
assert.equal(embedded.length,9);
function names(bytes){
 const count=bytes.readUInt16BE(4);let base;
 for(let i=0;i<count;i++){const offset=12+i*16;if(bytes.toString('ascii',offset,offset+4)==='name')base=bytes.readUInt32BE(offset+8);}
 assert.ok(base,'OpenType name table required');
 const strings=base+bytes.readUInt16BE(base+4),records=bytes.readUInt16BE(base+2),result={};
 for(let i=0;i<records;i++){const at=base+6+i*12,platform=bytes.readUInt16BE(at),language=bytes.readUInt16BE(at+4),nameId=bytes.readUInt16BE(at+6),length=bytes.readUInt16BE(at+8),offset=bytes.readUInt16BE(at+10);if(platform!==3||language!==0x0409||![0,1,2,5,16,17].includes(nameId))continue;const data=Buffer.from(bytes.subarray(strings+offset,strings+offset+length));data.swap16();result[nameId]=data.toString('utf16le');}
 return result;
}
for(let i=0;i<manifest.files.length;i++){
 const entry=manifest.files[i],bytes=readFileSync(new URL('fonts/'+entry.filename,root)),metadata=names(bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 assert.ok(bytes.equals(Buffer.from(embedded[i][1],'base64')),'CSS must embed exact original bytes');
 const expected={PreviewNotoCJK:/^Noto Sans CJK JP$/,PreviewNotoJP:/^Noto Sans JP$/,PreviewArimo:/^Arimo$/,PreviewHeros:/^TeX Gyre Heros$/,PreviewIPAMona:/^IPAMonaPGothicA$/,PreviewIPAPGothic:/^IPA\s?PGothic$/};
 assert.match(metadata[16]||metadata[1],expected[entry.family]);
 assert.match(metadata[17]||metadata[2],entry.weight===700?/Bold/:/Regular/);
 assert.ok(metadata[0],'Original copyright must be retained');
 console.log(entry.filename+': '+(metadata[16]||metadata[1])+' / '+(metadata[17]||metadata[2])+' / '+metadata[5]+' / hash+embedded bytes OK');
}

const html=readFileSync(new URL('index.html',root),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
assert.match(html,/href="bundled-fonts.css"/);
assert.ok(!html.includes('TYPE COMPARISON'));
assert.doesNotMatch(html,/<input\b[^>]*type=["']file/i,'Page must not offer font uploads');
assert.doesNotMatch(script,/indexedDB|parseOpenType|validateFont|restore\s*\(/,'Page must not store, restore, or parse uploaded fonts');
assert.doesNotMatch(html,/追加フォント|保存書体|IndexedDB/);
assert.match(html,/font-synthesis:none/);
assert.match(html,/min-height:70px;height:auto;max-height:none;overflow:visible/);
assert.doesNotMatch(html,/\.sample\{[^}]*overflow:auto/);
console.log('HTML script, bundled-font linkage, upload/storage removal, and full-text layout OK');

function element(){
 const children=new Map();
 return {textContent:'',value:'',style:{setProperty(){}},className:'',classList:{add(){},toggle(){}},append(){},replaceChildren(){children.clear();},querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);}};
}
const ui=new Map();
const document={
 querySelector(selector){if(!ui.has(selector))ui.set(selector,element());return ui.get(selector);},
 getElementById(id){return this.querySelector('#'+id);},createElement:element,documentElement:element(),
 fonts:{load:async()=>[{}],add(){},delete(){}}
};
document.querySelector('#text').value='日本語ABC123 <>&\n'.repeat(150);
document.querySelector('#size').value='28';document.querySelector('#weight').value='400';
const context=vm.createContext({console,document,Map,FontFace:class{constructor(family){this.family=family;}async load(){return this;}}});
const startup=script.lastIndexOf('fonts.forEach(cardFor');
assert.ok(startup>0,'Expected app initialization boundary');
vm.runInContext(script.slice(0,startup)+';this.api={fonts,render,initSubstitute,familyStack,detect};',context);
const api=context.api;
for(const font of api.fonts){font.card=element();font.sample=font.card.querySelector('.sample');font.originalLoad='done';font.substituteLoad='done';}

// 元書体と代替書体の選択、実際に使う日本語補完書体を確認
const jp=api.fonts.find(font=>font.id==='noto-jp'),arial=api.fonts.find(font=>font.id==='arial');
jp.substitute={family:'PreviewNotoJP',label:'Noto Sans JP',kind:'近似',source:'サイト同梱',weights:[400]};
arial.substitute={family:'PreviewArimo',label:'Arimo',kind:'字幅互換',source:'サイト同梱',weights:[400,700]};
arial.detected={family:'ArialInstalled',proof:'Arial',source:'端末',weights:[400]};
api.render();
assert.ok(api.familyStack(arial).startsWith('"ArialInstalled","PreviewNotoJP"'));
assert.equal(arial.card.querySelector('.display-name').textContent,'Arial');
assert.match(arial.card.querySelector('.load-info').textContent,/読込成功・端末・太さ 400/);
assert.equal(arial.sample.textContent,document.querySelector('#text').value);
assert.match(document.querySelector('#japaneseSupplement').textContent,/Noto Sans JP（サイト同梱）読込成功/);
assert.equal(api.familyStack(jp).startsWith('"PreviewNotoJP"'),true);

// 共通の日本語注記も、実際に選ばれた代替名と取得元に合わせる
jp.substitute={family:'PreviewNotoCJK',label:'Noto Sans CJK JP',source:'サイト同梱',weights:[400,700]};api.render();
assert.match(document.querySelector('#japaneseSupplement').textContent,/Noto Sans CJK JP（サイト同梱）読込成功/);
assert.ok(api.familyStack(arial).includes('PreviewNotoCJK'));

// 400だけの配布書体は、ブラウザーが700要求を400で解決しても700対応と扱わない
const mspgothic=api.fonts.find(font=>font.id==='mspgothic');
await api.initSubstitute(mspgothic);
assert.deepEqual(Array.from(mspgothic.substitute.weights),[400]);
assert.match(mspgothic.card.querySelector('.load-info').textContent,/元書体は未確認・代替は読込成功/);
document.querySelector('#weight').value='700';api.render();
assert.equal(mspgothic.sample.style.fontWeight,'400');

// 700を読めない元フォントに700を要求しても、実在する400を選ぶ
document.fonts.load=async query=>query.startsWith('700')?[]:[{}];
jp.detected=null;jp.originalLoad='pending';
await api.detect(jp);
assert.deepEqual(Array.from(jp.detected.weights),[400]);
document.querySelector('#weight').value='700';api.render();
assert.equal(jp.sample.style.fontWeight,'400');
assert.match(jp.card.querySelector('.load-info').textContent,/太さ 400/);

// 元・代替の読込失敗でも本文を保持し、成功状態を偽装しない
document.fonts.load=async()=>[];
for(const font of api.fonts){font.detected=null;font.substitute=null;font.originalLoad='done';font.substituteLoad='done';}
await Promise.all(api.fonts.map(font=>api.initSubstitute(font)));
api.render();
for(const font of api.fonts){
 assert.equal(font.sample.textContent,document.querySelector('#text').value);
 assert.match(font.sample.style.fontFamily,/sans-serif$/);
 assert.match(font.card.querySelector('.load-info').textContent,/確認できず/);
 assert.doesNotMatch(font.card.querySelector('.load-info').textContent,/読込成功/);
}
console.log('Original font precedence, Japanese supplement, bold fallback, and all-load-failure rendering OK');
