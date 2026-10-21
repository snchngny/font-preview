// 公式配布のフォントを変換せず、file://でも使えるdata URLとしてCSSへ格納する
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
const entries=[
 ['NotoSansCJKjp-Regular.otf','PreviewNotoCJK',400,'Sans/OTF/Japanese'],
 ['NotoSansCJKjp-Bold.otf','PreviewNotoCJK',700,'Sans/OTF/Japanese'],
 ['NotoSansJP-Regular.otf','PreviewNotoJP',400,'Sans/SubsetOTF/JP'],
 ['NotoSansJP-Bold.otf','PreviewNotoJP',700,'Sans/SubsetOTF/JP'],
 ['Arimo.ttf','PreviewArimo','400 700','https://raw.githubusercontent.com/google/fonts/main/ofl/arimo/Arimo%5Bwght%5D.ttf','SIL Open Font License 1.1'],
 ['texgyreheros-regular.otf','PreviewHeros',400,'https://mirrors.ctan.org/fonts/tex-gyre.zip','GUST Font License / LPPL 1.3c'],
 ['texgyreheros-bold.otf','PreviewHeros',700,'https://mirrors.ctan.org/fonts/tex-gyre.zip','GUST Font License / LPPL 1.3c'],
 ['IPAMonaPGothicA.ttf','PreviewIPAMona',400,'https://archive.org/details/ipamonafont-a-1.0.8.1','Original IPA / Sazanami / Mona / M+ terms; complete driver bundle included in fonts/ipamona-a.zip'],
 ['ipagp.ttf','PreviewIPAPGothic',400,'https://moji.or.jp/wp-content/ipafont/IPAfont/ipagp00303.zip','IPA Font License Agreement v1.0']
];
let css='/* Unmodified original font bytes and names retained. Noto: fonts/OFL.txt. Arimo: fonts/Arimo-OFL.txt. Heros: fonts/Heros-LICENSE.txt and tex-gyre.zip. IPA Mona A: fonts/IPAMona-COPYING.txt and complete original driver/font bundle fonts/ipamona-a.zip. IPA PGothic: fonts/IPA-License.txt. */\n';
const manifest=[];
for(const [filename,family,weight,directory,license] of entries){
 const bytes=readFileSync(new URL('fonts/'+filename,root));
 const type=filename.endsWith('.otf')?'otf':'ttf',format=type==='otf'?'opentype':'truetype';
 if(!(bytes.toString('ascii',0,4)==='OTTO'||bytes.readUInt32BE(0)===0x00010000))throw new Error('Invalid sfnt: '+filename);
 css+=`@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("data:font/${type};base64,${bytes.toString('base64')}") format("${format}");}\n`;
 manifest.push({filename,family,weight,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:directory.startsWith('https:')?directory:`https://raw.githubusercontent.com/notofonts/noto-cjk/main/${directory}/${filename}`,license:license||'SIL Open Font License 1.1'});
}
writeFileSync(new URL('bundled-fonts.css',root),css);
writeFileSync(new URL('fonts/sources.json',root),JSON.stringify({retrieved:'2026-10-22',files:manifest},null,2)+'\n');
console.log(JSON.stringify({css:fileURLToPath(new URL('bundled-fonts.css',root)),fonts:manifest.length,bytes:Buffer.byteLength(css)}));
