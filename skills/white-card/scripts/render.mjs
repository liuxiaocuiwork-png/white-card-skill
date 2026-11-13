#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { args,help } from './cli.mjs';
import { makeDraft,editorHTML,saveArtifacts } from './draft.mjs';

export async function renderCards(input, directory, options={}, runtime={}) {
  const {chromium}=await import('playwright');
  const draft=await makeDraft(input,options);
  let html=await editorHTML(draft);
  if(runtime.font){
    const fontPath=path.resolve(runtime.font),extension=path.extname(fontPath).toLowerCase();
    if(!['.ttf','.otf'].includes(extension))throw Error('--font 需要 TTF 或 OTF 字体。');
    const font=await fs.readFile(fontPath);
    if(font.length>40*1024*1024)throw Error('字体文件不能超过 40 MB。');
    // Embed inside the SVG too: an SVG image cannot access the page's FontFace set.
    const css=`@font-face{font-family:WhiteCardEmbedded;src:url(data:font/${extension.slice(1)};base64,${font.toString('base64')})}`;
    html=html.replace('<style>','<style>'+css).replace("const FONT = '","const FONT = 'WhiteCardEmbedded,");
    html=html.replace('<rect width="100%" height="100%" fill="white"/>','<style>'+css+'</style><rect width="100%" height="100%" fill="white"/>');
    html=html.replace('await document.fonts.ready;setupRichEditor();',"await document.fonts.load('44px WhiteCardEmbedded');await document.fonts.ready;setupRichEditor();");
  }
  const out=path.resolve(directory);
  try{if((await fs.readdir(out)).length)throw Error('渲染输出目录必须为空，以免覆盖已有卡片。');}catch(e){if(e.code!=='ENOENT')throw e;}
  const server=http.createServer((req,res)=>{
    if(req.method!=='GET'||req.url!=='/?automation=1'){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(runtime.channel?{channel:runtime.channel}:{}),timeout:30000});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    // The renderer has no reason to request remote resources or access an account.
    await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    const page=await context.newPage();page.setDefaultTimeout(30000);
    await page.goto(origin+'/?automation=1',{waitUntil:'load',timeout:30000});
    await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{},{timeout:30000});
    const layout=await page.evaluate(async raw=>await window.WhiteCard.load(raw),draft);
    if(layout.errors.length)throw Error(layout.errors.join('\n'));
    await saveArtifacts(draft,out);
    // Keep any explicitly supplied font in the portable HTML deliverable as well.
    if(runtime.font)await fs.writeFile(path.join(out,'editor.html'),html);
    const pngs=[];
    for(let i=0;i<layout.pageCount;i++){
      const data=await page.evaluate(async index=>await window.WhiteCard.png(index),i);
      const filename=`card-${String(i+1).padStart(2,'0')}.png`;
      await fs.writeFile(path.join(out,filename),Buffer.from(data.split(',')[1],'base64'),{flag:'wx'});
      pngs.push(filename);
    }
    // Store semantic layout alongside pixels, making truncation/overflow checkable.
    const report={pageCount:layout.pageCount,width:1080*draft.settings.scale,height:layout.pages[0].height*draft.settings.scale,bodySize:draft.settings.bodySize,files:pngs,pages:layout.pages.map(({svg,...p})=>p)};
    await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    await fs.writeFile(path.join(out,'layout.json'),JSON.stringify(layout,null,2)+'\n',{flag:'wx'});
    return {directory:out,...report};
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const a=args();if(a.help)console.log(help);else {const {pages,...summary}=await renderCards(a.input,a.out,a.options,{channel:a.channel,font:a.font});console.log(JSON.stringify(summary,null,2));}}
  catch(e){console.error(e.message);process.exitCode=1;}
}
