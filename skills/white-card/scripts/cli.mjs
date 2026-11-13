import { parseArgs } from 'node:util';
export function args(argv=process.argv.slice(2)) {
  const {values}=parseArgs({args:argv,options:{input:{type:'string'},out:{type:'string'},nickname:{type:'string'},title:{type:'string'},date:{type:'string'},avatar:{type:'string'},ratio:{type:'string'},scale:{type:'string'},channel:{type:'string'},font:{type:'string'},'no-badge':{type:'boolean'},help:{type:'boolean',short:'h'}}});
  if(values.help)return {help:true};
  if(!values.input||!values.out)throw Error('需要 --input <文章.md 或 JSON> 和 --out <新的输出目录>。');
  const options={settings:{}};
  for(const k of ['nickname','title','date','avatar'])if(values[k]!==undefined)options[k]=values[k];
  if(values.ratio)options.settings.ratio=values.ratio;
  if(values.scale)options.settings.scale=Number(values.scale);
  if(values['no-badge'])options.blueBadge=false;
  return {...values,options};
}
export const help=`用法：node scripts/create-draft.mjs --input article.md --out output/draft
      node scripts/render.mjs --input article.md --out output/cards

共同选项：--nickname 昵称 --title 标题 --date 日期 --avatar 本地图片
          --ratio 3:4|4:5|9:16|1:1 --scale 1|2 --no-badge
渲染选项：--channel msedge|chrome（默认使用 Playwright Chromium）
          --font /path/to/font.ttf（将本地 TTF/OTF 字体嵌入渲染）
图片路径相对于输入文件；--avatar 相对于当前目录。输出目录中的同名文件不会被覆盖。`;
