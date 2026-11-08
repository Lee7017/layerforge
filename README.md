## AI 写实包装图集（已入库）

- **[直接打开网页编辑 20 瓶包装图集](https://lee7017.github.io/layerforge/?version=ai-photo-20261108)**：默认内置 27 个图层，其中 20 个瓶子可独立移动、隐藏和调整。
- **[从 GitHub 下载 27 图层 PSD](https://github.com/Lee7017/layerforge/raw/refs/heads/main/assets/psd/chemical-packaging-ai-20-bottles.psd)**：14,083,942 字节，GitHub Actions 校验 SHA-256 `bfce00d0ae15044740bdf139468dfb064e23c3e70a0b1735f619a385dc7e335e`。
- **[查看网页内置的分层工程 JSON](https://github.com/Lee7017/layerforge/blob/main/public/examples/chemical-packaging-20.json)**：写实图层采用 WebP 压缩内嵌，方便 GitHub Pages 静态加载。
- 如果浏览器还显示旧几何示意图，刷新页面，点击顶部 **「AI写实20瓶图集」** 替换旧项目。
- **注意**：ChemSource / CS-1280 / 1 kg 等 AI 合成文字只是演示信息，不应当作真实化工厂产品规格或直接用于生产包装印刷。

# LayerForge · PSD 分层网页编辑器

## 不用导入 PSD：打开网页即可修改 20 瓶示例

打开 **https://lee7017.github.io/layerforge/**。首次访问（没有本地草稿）时，系统自动打开一套五视角包装的**结构示意模板**，其中开箱视角的 20 个瓶盖分别是独立图层，右侧直接显示数量精修面板。点击顶部「20瓶包装图集」可重新打开；浏览器已有草稿时优先恢复，避免覆盖数据。完成后直接点击「导出 PSD」或「导出 PNG」。

**重要区别：** 当前内置的是可编辑的**结构示意**，不是之前聊天中生成的实拍风格 30 MB PSD。原 PSD 和截图素材没有同步到 GitHub 仓库；因此这版不能声称已内置原图照片、原标签或真实遮挡纹理。网页中仍保留「导入 PSD」用于读取实际分层设计，亦可导出新建项目的 PSD。此示例只用于立即调节瓶数和位置，最终高清照片应以原始素材为准。


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

## 数量精修（AI 图片中 24 瓶改 20 瓶）

顶部点击 **「▦ 数量精修」**，右侧显示操作步骤：

1. **上传原图并建立画布**：上传 AI 成品 PNG / JPG / WebP，原图会作为锁定的背景；也可以先导入 PSD 并选中其中的位图图层。新建画布前先下载旧项目 JSON。
2. **提取单瓶**：选中一张图片图层，点击「从选中图片描边提取单瓶」，沿一只瓶子的轮廓逐点点击，至少 3 点后点击「完成提取」。这会从所选图片里手动裁出透明轮廓的单瓶位图，不是自动 AI 抠图；轮廓内原本的其他东西也会一起被裁出。推荐使用高清源图片。也可先导入独立透明单瓶 PNG，选中后点「使用选中图片作为单瓶模板」。
3. **设置排布**：列数填 `5`，排数填 `4`；调节瓶子宽高、起点 X/Y、行列间距及透视近似偏移。点击「生成 / 更新 20 个瓶子图层」，每瓶可单独拖动。再次生成会覆盖现有瓶阵的手动位置调整。
4. **处理原图错误内容**：**此版本不会自动消除原图里错误的 24 瓶，也不会自动生成干净箱内背景、真实遮挡和阴影。** 必须导入已经修补的纸箱底图，或手动以遮盖、箱沿等图层替换，避免成品同时出现新旧瓶子。
5. **检查后导出**：数量检查统计本工具生成且可见的瓶子图层，目标数量不符时会阻止 PNG / PSD 导出。**它无法识别原图里剩余的瓶子，因此仍须目视检查**。JSON 项目可继续编辑，PSD 中每瓶为独立位图图层。

数量上限每个瓶阵 120 瓶，当前版本一次管理一套瓶阵。排布用近似仿射排列，复杂透视和单瓶光照需要人工细调；浏览器静态部署不包含 AI 自动去物或局部重绘接口。

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
