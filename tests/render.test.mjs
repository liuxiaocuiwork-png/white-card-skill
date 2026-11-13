import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderCards} from '../skills/white-card/scripts/render.mjs';
import {makeDraft,dimensions} from '../skills/white-card/scripts/draft.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=process.argv.includes('--channel')?{channel:process.argv[process.argv.indexOf('--channel')+1]}:{};
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'white-card-render-'));
try{
  const mixed=path.join(root,'examples','mixed.json');
  const result=await renderCards(mixed,path.join(temp,'mixed'),{},runtime);
  assert.equal(result.pageCount,2);
  const bytes=await fs.readFile(path.join(temp,'mixed','card-01.png'));
  assert.deepEqual(dimensions(bytes),{width:2160,height:2880,mime:'image/png'});
  const layout=JSON.parse(await fs.readFile(path.join(temp,'mixed','layout.json'),'utf8'));
  const allSVG=layout.pages.map(p=>p.svg).join('');
  assert.match(allSVG,/font-weight="700"/);
  assert.match(allSVG,/text-decoration="underline"/);
  assert.match(allSVG,/width="650"/);
  assert.ok(allSVG.includes('#1d9bf0'));
  assert.equal(result.pages[1].items[0].text,'这是手动指定的新一页，正文字号与前页一致。');
  console.log('PASS: mixed marks, resized image, blue badge, manual page, 2× PNG');

  const article=path.join(root,'examples','article.md');
  const normal=await makeDraft(article);
  const pagination=await renderCards(article,path.join(temp,'normal'),{},runtime);
  const text=normal.blocks.filter(b=>b.type==='text').map(b=>b.text);
  const items=pagination.pages.flatMap(p=>p.items).filter(b=>b.type==='paragraph');
  assert.deepEqual(items.map(b=>b.text),text);
  for(const page of pagination.pages)for(const b of page.items)assert.ok(b.top+b.height<=page.height-58+.01,'content clipped');
  console.log('PASS: normal paragraphs stay whole and preserve text/order');

  const longText='这是一个很长的段落，必须在多张卡片之间继续，所有文字都应完整保留。'.repeat(45);
  const input=path.join(temp,'long.json');
  await fs.writeFile(input,JSON.stringify({title:'续页测试',blocks:[{type:'text',text:longText}],settings:{scale:1}}));
  const long=await renderCards(input,path.join(temp,'long'),{},runtime);
  assert.ok(long.pageCount>=3);
  assert.equal(long.pages.flatMap(p=>p.items).filter(b=>b.type==='paragraph').map(b=>b.text).join(''),longText);
  const longLayout=JSON.parse(await fs.readFile(path.join(temp,'long','layout.json'),'utf8'));
  for(const page of longLayout.pages){assert.match(page.svg,/font-size="44"/);for(const b of page.items)assert.ok(b.top+b.height<=page.height-58+.01);}
  console.log('PASS: long paragraph continues without text loss or font shrink');

  const bad=path.join(temp,'bad.json');
  await fs.writeFile(bad,JSON.stringify({title:'标题'.repeat(500),blocks:[]}));
  await assert.rejects(()=>renderCards(bad,path.join(temp,'bad'),{},runtime),/标题超过一页/);
  await assert.rejects(()=>fs.access(path.join(temp,'bad','card-01.png')));
  console.log('PASS: invalid layout refuses clipped PNG export');
}finally{await fs.rm(temp,{recursive:true,force:true});}
