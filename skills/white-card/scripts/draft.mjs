import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const skillDir = fileURLToPath(new URL('../', import.meta.url));
export const defaults = {ratio:'3:4',scale:2,titleSize:52,bodySize:44,lineHeight:1.65,paragraphGap:32,margin:40,radius:24,repeatHeader:false,showPageNumber:false};
const bounds = {titleSize:[40,66],bodySize:[32,54],lineHeight:[1.35,1.95],paragraphGap:[18,60],margin:[36,90],radius:[0,40]};
export function dimensions(b) {
  let width, height, mime;
  if (b.length >= 24 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    width=b.readUInt32BE(16);height=b.readUInt32BE(20);mime='image/png';
  } else if (b.length > 4 && b[0]===255 && b[1]===216) {
    let p=2;
    while(p+4<=b.length){
      if(b[p++]!==255)continue;
      while(b[p]===255)p++;
      const marker=b[p++];
      if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      if(p+2>b.length)break;
      const len=b.readUInt16BE(p);
      if(len<2||p+len>b.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&len>=8){height=b.readUInt16BE(p+3);width=b.readUInt16BE(p+5);mime='image/jpeg';break;}
      p+=len;
    }
  } else if(b.length>=30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
    const type=b.toString('ascii',12,16);mime='image/webp';
    if(type==='VP8X'){width=1+b.readUIntLE(24,3);height=1+b.readUIntLE(27,3);}
    else if(type==='VP8 '&&b.length>=30){width=b.readUInt16LE(26)&16383;height=b.readUInt16LE(28)&16383;}
    else if(type==='VP8L'&&b[20]===47){width=1+(((b[22]&63)<<8)|b[21]);height=1+(((b[24]&15)<<10)|(b[23]<<2)|(b[22]>>6));}
  }
  if(!width||!height||!mime)throw Error('图片必须是有效的 PNG、JPEG 或 WebP。');
  return {width,height,mime};
}
export async function photo(value, baseDir) {
  if(typeof value!=='string'||!value)throw Error('图片需要本地路径或 data URL。');
  let bytes;
  if(value.startsWith('data:')){
    const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/);
    if(!match)throw Error('仅支持 PNG、JPEG、WebP 的 base64 图片。');
    bytes=Buffer.from(match[2],'base64');
  }else{
    if(/^[a-z][a-z0-9+.-]*:\/\//i.test(value))throw Error('配图请使用本地文件；不会自动下载远程图片。');
    const filename=path.resolve(baseDir,value);
    const info=await fs.stat(filename);
    if(info.size>30*1024*1024)throw Error('单张图片不能超过 30 MB。');
    bytes=await fs.readFile(filename);
  }
  if(bytes.length>30*1024*1024)throw Error('单张图片不能超过 30 MB。');
  const {width,height,mime}=dimensions(bytes);
  return {src:`data:${mime};base64,${bytes.toString('base64')}`,width,height};
}
export function inline(text) {
  const runs=[];let bold=false,underline=false;
  for(const token of text.split(/(\*\*|<u>|<\/u>)/g)){
    if(token==='**')bold=!bold;
    else if(token==='<u>')underline=true;
    else if(token==='</u>')underline=false;
    else if(token)runs.push({text:token,bold,underline});
  }
  return runs;
}
export function markdown(text) {
  const blocks=[];let title='',paragraph=[];
  const flush=()=>{if(paragraph.length){const runs=inline(paragraph.join('\n'));blocks.push({type:'text',runs});paragraph=[];}};
  for(const line of text.replace(/\r/g,'').split('\n')){
    if(!title&&!blocks.length&&!paragraph.length&&line.startsWith('# ')){title=line.slice(2).trim();continue;}
    const image=line.match(/^!\[[^\]]*\]\((.+)\)\s*$/);
    if(!line.trim()){flush();continue;}
    if(image){flush();blocks.push({type:'image',src:image[1],fit:'original',widthPercent:100});continue;}
    if(line.trim()==='---'){flush();blocks.push({type:'break'});continue;}
    paragraph.push(line);
  }
  flush();return {title,blocks};
}
export function settings(raw={}) {
  const out={...defaults,...raw};
  for(const key of Object.keys(raw))if(!(key in defaults))throw Error(`未知排版设置：${key}`);
  if(!['3:4','4:5','9:16','1:1'].includes(out.ratio))throw Error('ratio 必须是 3:4、4:5、9:16 或 1:1。');
  if(![1,2].includes(out.scale))throw Error('scale 必须是 1 或 2。');
  for(const [key,[min,max]] of Object.entries(bounds))if(!Number.isFinite(out[key])||out[key]<min||out[key]>max)throw Error(`${key} 必须在 ${min}–${max} 之间。`);
  for(const key of ['repeatHeader','showPageNumber'])if(typeof out[key]!=='boolean')throw Error(`${key} 必须是布尔值。`);
  return out;
}
export async function makeDraft(input, options={}) {
  const filename=path.resolve(input),baseDir=path.dirname(filename);
  const source=await fs.readFile(filename,'utf8');
  const raw=filename.toLowerCase().endsWith('.json')?JSON.parse(source.replace(/^\uFEFF/,'')):markdown(source.replace(/^\uFEFF/,''));
  if(!raw||!Array.isArray(raw.blocks)||raw.blocks.length>2000)throw Error('输入需要 blocks 数组，最多 2000 块。');
  const date=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  const draft={version:2,nickname:options.nickname??raw.nickname??'你的昵称',date:options.date??raw.date??date,title:options.title??raw.title??'',avatar:'',blueBadge:options.blueBadge??raw.blueBadge??true,settings:settings({...raw.settings,...options.settings}),blocks:[]};
  for(const [key,max] of [['nickname',32],['date',45],['title',20000]])if(typeof draft[key]!=='string'||draft[key].length>max)throw Error(`${key} 必须是最多 ${max} 字符的文字。`);
  if(typeof draft.blueBadge!=='boolean')throw Error('blueBadge 必须是布尔值。');
  if(options.avatar||raw.avatar)draft.avatar=(await photo(options.avatar??raw.avatar,options.avatar?process.cwd():baseDir)).src;
  for(const b of raw.blocks){
    if(!b||typeof b!=='object')throw Error('内容块格式不正确。');
    const id=`b${draft.blocks.length+1}`;
    if(b.type==='text'){
      let runs=b.runs;
      if(runs===undefined){if(typeof b.text!=='string')throw Error('文字块缺少 text 或 runs。');runs=[{text:b.text}];}
      if(!Array.isArray(runs)||runs.length>50000||runs.some(r=>!r||typeof r.text!=='string'||['bold','underline'].some(k=>r[k]!==undefined&&typeof r[k]!=='boolean')))throw Error('runs 格式不正确。');
      runs=runs.map(r=>({text:r.text,bold:!!r.bold,underline:!!r.underline}));
      const text=runs.map(r=>r.text).join('');
      // A block is a paragraph. Preserve explicit hard line breaks inside it.
      if(text.trim())draft.blocks.push({id,type:'text',text,runs});
    }else if(b.type==='image'){
      const fit=b.fit??'original',widthPercent=b.widthPercent??100;
      if(!['original','16:9','4:3','1:1'].includes(fit)||!Number.isFinite(widthPercent)||widthPercent<20||widthPercent>100)throw Error('图片比例或宽度不正确。');
      draft.blocks.push({id,type:'image',...await photo(b.src??b.path,baseDir),fit,widthPercent});
    }else if(b.type==='break')draft.blocks.push({id,type:'break'});
    else throw Error(`未知内容块：${b.type}`);
  }
  if(draft.blocks.reduce((n,b)=>n+(b.text?.length||0),0)>150000)throw Error('正文不能超过 150000 字符。');
  if(Buffer.byteLength(JSON.stringify(draft))>80*1024*1024)throw Error('草稿不能超过 80 MB。');
  return draft;
}
export async function editorHTML(draft) {
  const template=await fs.readFile(path.join(skillDir,'assets','editor.html'),'utf8');
  const json=JSON.stringify(draft).replace(/</g,'\\u003c').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return template.replace('<script>','<script type="application/json" id="white-card-draft">'+json+'</script>\n<script>');
}
export async function saveArtifacts(draft, directory) {
  const out=path.resolve(directory);
  await fs.mkdir(out,{recursive:true});
  const names=['draft.json','editor.html'];
  for(const name of names){try{await fs.access(path.join(out,name));throw Error(`输出已存在：${name}。请使用新的输出目录。`);}catch(e){if(e.code!=='ENOENT')throw e;}}
  await fs.writeFile(path.join(out,'draft.json'),JSON.stringify(draft,null,2)+'\n',{flag:'wx'});
  await fs.writeFile(path.join(out,'editor.html'),await editorHTML(draft),{flag:'wx'});
  return out;
}
