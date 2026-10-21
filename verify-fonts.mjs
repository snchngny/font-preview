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
 const count=bytes.readUInt16BE(4);
 let base;
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
console.log('HTML script syntax and font linkage OK');
// ブラウザーを起動せず、実ファイルで書体照合と復元競合を確認する
const context=vm.createContext({console,document:{querySelector:()=>({value:'400'}),fonts:{add(){},delete(){}}},FontFace:class{constructor(family){this.family=family;}async load(){return this;}},Map,Uint8Array,DataView});
const startup=script.lastIndexOf('fonts.forEach((font,index)=>cardFor');
assert.ok(startup>0);
vm.runInContext(script.slice(0,startup)+';this.api={fonts,parseOpenType,validateFont,familyStack,restore,render,initSubstitute};',context);
const api=context.api;
function arrayBuffer(buffer){return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);}
for(const entry of manifest.files.filter(f=>f.family.startsWith('PreviewNoto'))){
 const buffer=arrayBuffer(readFileSync(new URL('fonts/'+entry.filename,root)));
 const parsed=api.parseOpenType(buffer),id=entry.family==='PreviewNotoCJK'?'noto-cjk':'noto-jp',font=api.fonts.find(f=>f.id===id);
 assert.equal(api.validateFont(font,parsed).weight,entry.weight);
 const wrong=api.fonts.find(f=>f.id===(id==='noto-jp'?'noto-cjk':'noto-jp'));
 assert.throws(()=>api.validateFont(wrong,parsed),/書体名が一致しません/);
}
assert.throws(()=>api.parseOpenType(arrayBuffer(Buffer.from('ttcf000000000000'))),/TTC/);
assert.throws(()=>api.parseOpenType(arrayBuffer(Buffer.alloc(3))),/短すぎ/);
const arial=api.fonts.find(f=>f.id==='arial'),helvetica=api.fonts.find(f=>f.id==='helvetica');
for(const font of api.fonts)assert.match(api.familyStack(font),/sans-serif$/,'Every card must retain a final fallback');
assert.match(html,/min-height:70px;height:auto;max-height:none;overflow:visible/);
assert.ok(!/\.sample\{[^}]*overflow:auto/.test(html));
assert.throws(()=>api.validateFont(helvetica,{familyNames:['Helvetica Neue'],family:'Helvetica Neue',fullName:'Helvetica Neue',postScript:'HelveticaNeue',subfamily:'Regular'}),/書体名が一致しません/);
assert.throws(()=>api.validateFont(arial,{familyNames:['Arial Narrow'],family:'Arial Narrow',fullName:'Arial Narrow',postScript:'ArialNarrow',subfamily:'Regular'}),/書体名が一致しません/);
context.savedBuffer=arrayBuffer(readFileSync(new URL('fonts/NotoSansJP-Regular.otf',root)));
vm.runInContext('render=()=>{};badge=()=>{};detect=async()=>{};this.release=null;idbRequest=()=>new Promise(resolve=>{this.release=resolve;});fonts.forEach(f=>f.generation=0);this.pending=restore();fonts[3].generation++;fonts[3].uploaded={family:"newer-manual-upload"};',context);
context.release([{id:'noto-jp',buffer:context.savedBuffer,filename:'saved.otf'}]);
await context.pending;
assert.equal(api.fonts[3].uploaded.family,'newer-manual-upload','Old saved data must not overwrite a newer manual upload');
vm.runInContext('fonts[3].uploaded=null;fonts[3].generation=0;this.pending=restore();',context);
context.release([{id:'noto-jp',buffer:context.savedBuffer,filename:'saved.otf'}]);
await context.pending;
assert.equal(api.fonts[3].saved,true);
assert.equal(api.fonts[3].uploaded.weight,400);
assert.match(api.fonts[3].uploaded.proof,/Noto Sans JP/);
console.log('Font identity/mismatch checks, restored font identity, and stale-restore guard OK (unit checks; browser storage/visual layout unverified)');
// 実書体優先・未導入時の代替名・全文表示・読込失敗を確認
function element(){const children=new Map();return {textContent:'',value:'',style:{setProperty(){}},classList:{add(){},toggle(){}},append(){},replaceChildren(){},querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);}};}
const ui=new Map();
const doc={querySelector(selector){if(!ui.has(selector))ui.set(selector,element());return ui.get(selector);},getElementById(id){return this.querySelector('#'+id);},createElement:element,documentElement:element(),fonts:{load:async()=>[{}],add(){},delete(){}}};
doc.querySelector('#size').value='28';doc.querySelector('#weight').value='400';doc.querySelector('#text').value='日本語ABC123 <>&\n'.repeat(150);
const renderContext=vm.createContext({console,document:doc,Map,Uint8Array,DataView});
vm.runInContext(script.slice(0,startup)+';this.api={fonts,render,initSubstitute,familyStack};',renderContext);
const renderApi=renderContext.api;
for(const font of renderApi.fonts){font.card=element();font.sample=element();}
renderApi.render();
await Promise.all(renderApi.fonts.map(font=>renderApi.initSubstitute(font)));
const expectedFallbacks={arial:'PreviewArimo',helvetica:'PreviewHeros','noto-cjk':'PreviewNotoJP','noto-jp':'PreviewNotoCJK',hiragino:'PreviewNotoJP',mspgothic:'PreviewIPAMona'};
for(const font of renderApi.fonts){assert.equal(font.substitute.family,expectedFallbacks[font.id]);assert.ok(font.sample.style.fontFamily.startsWith('"'+expectedFallbacks[font.id]+'"'));assert.equal(font.sample.textContent,doc.querySelector('#text').value);assert.match(font.card.querySelector('.sample-note').textContent,/表示：/);}
assert.match(renderApi.fonts[0].card.querySelector('.compatibility-info').textContent,/字幅互換・字形は別/);
assert.match(renderApi.fonts[1].card.querySelector('.compatibility-info').textContent,/一部文字に例外/);
assert.match(renderApi.fonts[4].card.querySelector('.compatibility-info').textContent,/近似.*字幅一致は未確認/);
assert.match(renderApi.fonts[5].card.querySelector('.compatibility-info').textContent,/AA向け字幅互換/);
for(const i of [0,1])assert.ok(renderApi.familyStack(renderApi.fonts[i]).includes('PreviewNotoJP'),'Latin cards must disclose/use Japanese supplement');
assert.deepEqual(Array.from(renderApi.fonts[5].substitute.weights),[400]);
assert.equal(doc.querySelector('#availability').textContent,'代替表示 6書体');
for(const font of renderApi.fonts)font.detected={family:'Exact_'+font.id,proof:'端末の元フォント：'+font.name,weights:[400]};
renderApi.render();
for(const font of renderApi.fonts){assert.ok(font.sample.style.fontFamily.startsWith('"Exact_'+font.id+'"'));assert.equal(font.sample.textContent,doc.querySelector('#text').value);assert.equal(font.card.querySelector('.badge').textContent,'実フォント');assert.ok(font.card.querySelector('.sample-note').textContent.includes(font.name));}
for(const font of renderApi.fonts)assert.match(font.card.querySelector('.compatibility-info').textContent,/実フォント（元の書体）/);
assert.equal(doc.querySelector('#count').textContent,'実フォント 6 / 6');
assert.equal(doc.querySelector('#availability').textContent,'代替表示 0書体');
// 保存済みの実フォントは検出済み書体・代替よりも優先
renderApi.fonts[0].uploaded={family:'SavedArial',weight:400,proof:'Arial Regular'};renderApi.render();assert.ok(renderApi.fonts[0].sample.style.fontFamily.startsWith('"SavedArial"'));
// 第一候補の読込失敗なら次の候補を明示
for(const font of renderApi.fonts){font.detected=null;font.uploaded=null;}
doc.fonts.load=async query=>query.includes('PreviewIPAMona')?[]:[{}];await renderApi.initSubstitute(renderApi.fonts[5]);assert.equal(renderApi.fonts[5].substitute.family,'PreviewIPAPGothic');
// 全フォント読込失敗でも本文を欠落させない
doc.fonts.load=async()=>[];await Promise.all(renderApi.fonts.map(font=>renderApi.initSubstitute(font)));
for(const font of renderApi.fonts){assert.equal(font.sample.textContent,doc.querySelector('#text').value);assert.equal(font.card.querySelector('.badge').textContent,'代替：端末標準');assert.match(font.sample.style.fontFamily,/sans-serif$/);}
console.log('Originals override named compatible substitutes; uploaded originals win; complete text preserved; secondary and generic fallbacks verified');
