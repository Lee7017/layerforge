# LayerForge · PSD 分层网页编辑器

纯前端分层画布：**导入 PSD**、批量导入 AI 生成的 **PNG / JPG / WebP / GIF 素材**、拖拽/缩放/旋转/排序图层、编辑文字/矩形、导出 **分层 PSD + PNG + 可恢复编辑的 JSON 项目**。部署到 GitHub Pages，无需服务器，也无需调用任何 AI 服务的密钥。

> “AI 分层素材排版”指将生成式 AI 输出的**单独素材文件**（通常是带透明背景的 PNG）作为独立图层导入、编辑、导出。这里没有内置文字生成图片功能，也不会自动从单张图片中分离所有对象。

## 运行

要求 Node.js 20.19+ 或 22+，npm。

```bash
npm install
npm run dev
```

打开终端给出的网址。构建：

```bash
npm run build
npm run preview
```

## 部署 GitHub Pages

1. 在 GitHub 新建仓库，例如 `layerforge-pages`，把项目全部文件（**包括 `.github/workflows/deploy.yml`**）推送到 `main` 分支。
2. 进入仓库 **Settings → Pages → Build and deployment → Source → GitHub Actions**。
3. 此项目已提供 GitHub Actions 工作流；推送 main 或在 Actions 中手动运行后，会构建 `dist` 并发布。
4. 访问 `https://<你的用户名>.github.io/<仓库名>/`。

工作流根据仓库名称自动配置 Vite 的 `base`。如果你不是通过该工作流部署，则运行：

```bash
# Linux / macOS
GITHUB_PAGES_BASE=/你的仓库名/ npm run build
```

### 推送到仓库

```bash
git init
git add .
git commit -m "Initial LayerForge editor"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

### 使用方式

- 左上角“打开 PSD / 导入素材”：支持拖入 PSD、项目 JSON、图片文件。若一起导入 PSD 和图片，将先载入 PSD，再添加图片。
- 中间画布：点击图层，拖动移动；拖动四角调整宽高；顶部旋转手柄旋转。
- 左侧图层：按鼠标拖动列表行更改层级顺序；切换显示、锁定；复制或删除。
- 右侧属性：修改坐标、尺寸、透明度、文字、形状颜色；选中图片时可替换。
- 撤销/重做：`Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z` 或 `Ctrl+Y`。箭头移动选中图层，按住 Shift 一次移动 10 px。
- “保存项目”：下载完整 `.layerforge.json`，图片数据嵌入文件，之后可重新导入并继续编辑。
- 浏览器支持 IndexedDB 时，会自动保留最近一次编辑状态；**大项目建议额外下载 JSON 备份**。

## PSD 支持边界（请务必了解）

- 导入：读出可用的图层位图，嵌套组显示为名称路径并按顺序展开；图层位置、可见性、透明度会尽量保留。
- PSD 原生可编辑文字、智能对象、滤镜、蒙版、调整图层、特殊混合模式、组效果等**不会完整保留**。文字通常以原始 PSD 中渲染出的位图形式导入。无法提取位图的图层会被跳过并发出提示。
- 导出：每一个本编辑器图层都会成为 PSD 中**独立的像素图层**；隐藏层也会保留。编辑器中的文字、矩形在 PSD 中也会被栅格化，只有 `.layerforge.json` 能保持其在本编辑器内可继续修改的原生属性。
- PSD 仅输出 RGB 8-bit。PSB、超大型 PSD 和部分颜色模式/新 Photoshop 特性不支持或受 `ag-psd` 限制。
- 对极大图像、几十个高分辨率图层，浏览器会需要大量内存，建议先缩小画布或压缩素材。
- 合成图 PNG 和 PSD 图层为浏览器 Canvas 绘制。复杂字体折行可能与 Konva 的屏幕预览存在细小差别；PSD 导出前建议检查 PNG。
- 若要**原样往返保留复杂 PSD 文件**，仍建议 Photoshop / Photopea 等专业工具。

## 文件说明

- `src/App.tsx`：编辑器 UI、图层操作、快捷键、导入导出操作。
- `src/io.ts`：读取 PSD、读取图片、Canvas 栅格化、导出 PSD / PNG / JSON。
- `src/types.ts`：项目及图层数据结构和示例画布。
- `src/storage.ts`：浏览器 IndexedDB 自动保存。
- `src/styles.css`：响应式界面样式。
- `vite.config.ts`：Vite，支持 GitHub 仓库子路径。
- `.github/workflows/deploy.yml`：自动构建并部署至 GitHub Pages。

## 技术栈

React、TypeScript、Vite、Konva / react-konva、ag-psd。所有图像处理在本地浏览器进行，没有图片上传后端。

## 第三方参考

- [ag-psd 官方仓库](https://github.com/Agamnentzar/ag-psd)
- [Konva Transformer 文档](https://konvajs.org/docs/react/Transformer.html)
- [Vite GitHub Pages 部署指南](https://vite.dev/guide/static-deploy)

MIT License (project source code; third-party libraries follow their respective licenses).
