import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {markdown,makeDraft,editorHTML,saveArtifacts,dimensions,settings} from '../skills/white-card/scripts/draft.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));

test('Markdown keeps paragraph, image, marks and manual-break order',()=>{
  const result=markdown('# 标题\n\n普通 **<u>重点</u>** 末尾\n换行\n\n![图](a.png)\n\n后文\n\n---\n\n尾段');
  assert.equal(result.title,'标题');
  assert.deepEqual(result.blocks.map(b=>b.type),['text','image','text','break','text']);
  assert.equal(result.blocks[0].runs.map(r=>r.text).join(''),'普通 重点 末尾\n换行');
  assert.deepEqual(result.blocks[0].runs[1],{text:'重点',bold:true,underline:true});
});
test('JSON images embed and Unicode content survives a portable HTML round trip',async()=>{
  const draft=await makeDraft(path.join(root,'examples','mixed.json'));
  assert.equal(draft.blocks[1].width,1200);
  assert.equal(draft.blocks[1].height,675);
  assert.equal(draft.blocks[1].widthPercent,65);
  assert.ok(draft.blocks[1].src.startsWith('data:image/png;base64,'));
  draft.title='文字 </script><script>bad()</script> & 测试';
  const html=await editorHTML(draft);
  const json=html.match(/id="white-card-draft">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(json).title,draft.title);
  assert.ok(!json.includes('</script>'));
});
test('Draft output refuses to overwrite files and can be imported again',async()=>{
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'white-card-unit-'));
  try{
    const draft=await makeDraft(path.join(root,'examples','article.md'),{nickname:'测试'});
    await saveArtifacts(draft,tmp);
    const again=await makeDraft(path.join(tmp,'draft.json'));
    assert.deepEqual(again,draft);
    await assert.rejects(()=>saveArtifacts(draft,tmp),/输出已存在/);
  }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('Invalid formats and out-of-range settings fail early',()=>{
  assert.throws(()=>dimensions(Buffer.from('not an image')),/有效/);
  assert.throws(()=>settings({bodySize:10}),/bodySize/);
  assert.throws(()=>settings({scale:3}),/scale/);
  assert.throws(()=>settings({unknown:true}),/未知/);
});
test('Remote image sources are rejected',async()=>{
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'white-card-url-'));
  try{
    const input=path.join(tmp,'input.md');await fs.writeFile(input,'![图](https://example.com/image.png)');
    await assert.rejects(()=>makeDraft(input),/本地文件/);
  }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
