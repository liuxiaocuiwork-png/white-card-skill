# 输入与草稿格式

`create-draft.mjs` 和 `render.mjs` 使用相同输入。Markdown 支持下列子集：

```markdown
# 卡片标题

普通文字、**加粗**、<u>下划线</u>、**<u>两者同时</u>**。

![说明](./photo.png)

图片后继续正文。空行划分段落；段落内换行保留。

---

这段从新页开始。
```

图片必须独占一行，支持本地 PNG/JPEG/WebP；相对路径按输入文件所在目录解析。第一行一级标题作为卡片标题，`---` 作为手动分页。其他 Markdown/HTML 语法按普通文字处理。本工具不执行 HTML。请使用成对的 `**` 和 `<u></u>` 标记；需要包含这些字符的字面文本时改用 JSON 的 `text`。

## JSON

```json
{
  "version": 2,
  "nickname": "你的昵称",
  "date": "2026年11月13日 20:00",
  "title": "一个清楚的标题",
  "avatar": "./avatar.png",
  "blueBadge": true,
  "settings": { "ratio": "3:4", "scale": 2 },
  "blocks": [
    { "type": "text", "runs": [
      { "text": "普通文字。" },
      { "text": "强调文字。", "bold": true, "underline": true }
    ] },
    { "type": "image", "src": "./photo.png", "fit": "original", "widthPercent": 80 },
    { "type": "text", "text": "图片后继续正文。" },
    { "type": "break" },
    { "type": "text", "text": "新一页。" }
  ]
}
```

输入 JSON 可省略 `version`、`avatar`、`blueBadge`、`settings`、`nickname`、`date` 和 `title`；不省略 `blocks`。输出一律是编辑器可导入的 v2 JSON，所有图片已转为 base64 data URL，并补齐 `id`、`text`、尺寸、样式及默认值。

- 一个文字块代表一个段落。`runs` 比 `text` 优先；每个 run 的 `bold`/`underline` 默认为 false。JSON `text` 是字面文本，不解析 Markdown。
- 图片 `fit` 可选 `original`、`16:9`、`4:3`、`1:1`；`widthPercent` 范围 20–100，表示占正文宽度的百分比。CLI 会读取真实图片尺寸，渲染时再由浏览器解码确认。
- 蓝色勾标是视觉装饰，不代表平台认证、关注状态或官方身份。
- 默认日期取运行机器的本地日期时间；需要固定显示时显式提供 `date`。
- 昵称最多 32 字符、日期最多 45 字符、标题最多 20000 字符、正文最多 150000 字符、最多 2000 块。标题还须能放入一页，否则拒绝导出。单图最多 30 MB、草稿最多 80 MB。

## 排版设置

| 字段 | 默认值 | 可用范围 |
|---|---|---|
| ratio | 3:4 | 3:4、4:5、9:16、1:1 |
| scale | 2 | 1、2 |
| titleSize | 52 | 40–66 |
| bodySize | 44 | 32–54 |
| lineHeight | 1.65 | 1.35–1.95 |
| paragraphGap | 32 | 18–60 |
| margin | 40 | 36–90 |
| radius | 24 | 0–40 |
| repeatHeader | false | true、false |
| showPageNumber | false | true、false |

字号/边距单位是 1080 像素设计画布上的 px，PNG 导出整体按 scale 放大，不改变相对排版。四种比例在 1 倍时分别为 1080×1440、1080×1350、1080×1920、1080×1080。

## 输出

- `card-01.png` 等：实际卡片图片。
- `editor.html`：已填入初始内容的独立编辑器，无网络依赖；重新打开会回到嵌入的初始内容，编辑后请保存 JSON。
- `draft.json`：可移植草稿，直接在编辑器导入。
- `manifest.json`：页数、尺寸、文件名、各块页面位置。
- `layout.json`：完整 SVG 和语义排版信息，便于验证或排错。

原生 v1 草稿可在网页中导入并迁移；命令行以本文档的段落模型为准。离线编辑器本身使用系统字体；跨机器换行一致时用 `render.mjs --font 字体.ttf`，生成的独立 HTML 也会包含该字体。字体文件是否可以分发由其许可证决定。
