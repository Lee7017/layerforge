import { clamp, makeId, validProject } from './types';
import type { EditorLayer, PictureLayer, Project } from './types';

const imagePromises = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  const existing = imagePromises.get(src);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片读取失败，请检查文件格式'));
    img.src = src;
  });
  imagePromises.set(src, promise);
  promise.catch(() => imagePromises.delete(src));
  return promise;
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const safeFilename = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').trim() || 'layerforge';

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error(`${file.name} 读取失败`));
    r.readAsDataURL(file);
  });
}

export async function imageFilesToLayers(files: File[], doc: Project): Promise<PictureLayer[]> {
  const layers: PictureLayer[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/') || !/image\/(png|jpeg|webp|gif)/i.test(file.type)) {
      throw new Error(`暂不支持 ${file.name}：请用 PNG / JPG / WebP / GIF`);
    }
    if (file.size > 35 * 1024 * 1024) throw new Error(`${file.name} 大于 35MB，建议先压缩`);
    const src = await fileToDataUrl(file);
    const img = await loadImage(src);
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    const ratio = Math.min(1, doc.width * .76 / width, doc.height * .76 / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
    layers.push({ id: makeId(), type: 'image', name: file.name.replace(/\.[^.]+$/, ''), src,
      x: Math.round((doc.width - width) / 2), y: Math.round((doc.height - height) / 2),
      width, height, rotation: 0, opacity: 1, visible: true, locked: false });
  }
  return layers;
}

// Pixel rendering is the single source of truth for PNG and layered PSD output.
// Text and shape layers remain editable in the JSON project. PSD stores each
// layer separately as a bitmap to maximize interoperability.
async function drawLayer(ctx: CanvasRenderingContext2D, layer: EditorLayer,
  offsetX = 0, offsetY = 0, applyOpacity = true): Promise<void> {
  ctx.save();
  ctx.globalAlpha = applyOpacity ? clamp(layer.opacity, 0, 1) : 1;
  ctx.translate(layer.x - offsetX, layer.y - offsetY);
  ctx.rotate(layer.rotation * Math.PI / 180);
  if (layer.type === 'image') {
    const img = await loadImage(layer.src);
    ctx.drawImage(img, 0, 0, layer.width, layer.height);
  } else if (layer.type === 'shape') {
    ctx.fillStyle = layer.fill;
    const radius = clamp(layer.radius, 0, Math.min(layer.width, layer.height) / 2);
    ctx.beginPath();
    ctx.roundRect(0, 0, layer.width, layer.height, radius);
    ctx.fill();
  } else {
    ctx.fillStyle = layer.color;
    ctx.font = `${layer.bold ? 'bold ' : ''}${layer.fontSize}px ${layer.fontFamily}`;
    ctx.textBaseline = 'top';
    const lineHeight = layer.fontSize * 1.2;
    const lines: string[] = [];
    for (const para of layer.text.split('\n')) {
      if (!para) { lines.push(''); continue; }
      let line = '';
      for (const ch of para) {
        if (line && ctx.measureText(line + ch).width > layer.width) {
          lines.push(line); line = ch;
        } else line += ch;
      }
      lines.push(line);
    }
    lines.forEach((line, i) => {
      if ((i + 1) * lineHeight <= layer.height + lineHeight * .3)
        ctx.fillText(line, 0, i * lineHeight);
    });
  }
  ctx.restore();
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 Canvas 2D');
  return canvas;
}

export async function compositeCanvas(project: Project): Promise<HTMLCanvasElement> {
  const canvas = createCanvas(project.width, project.height);
  const ctx = canvas.getContext('2d')!;
  for (const layer of [...project.layers].reverse()) {
    if (layer.visible) await drawLayer(ctx, layer);
  }
  return canvas;
}
function corners(layer: EditorLayer) {
  const cos = Math.cos(layer.rotation * Math.PI / 180);
  const sin = Math.sin(layer.rotation * Math.PI / 180);
  return [[0, 0], [layer.width, 0], [0, layer.height], [layer.width, layer.height]]
    .map(([x, y]) => ({ x: layer.x + x * cos - y * sin, y: layer.y + x * sin + y * cos }));
}
async function rasterizedLayer(layer: EditorLayer) {
  const pts = corners(layer);
  const left = Math.floor(Math.min(...pts.map(p => p.x))) - (layer.type === 'text' ? 2 : 0);
  const top = Math.floor(Math.min(...pts.map(p => p.y))) - (layer.type === 'text' ? 2 : 0);
  const right = Math.ceil(Math.max(...pts.map(p => p.x))) + (layer.type === 'text' ? 2 : 0);
  const bottom = Math.ceil(Math.max(...pts.map(p => p.y))) + (layer.type === 'text' ? 2 : 0);
  const canvas = createCanvas(Math.max(1, right - left), Math.max(1, bottom - top));
  await drawLayer(canvas.getContext('2d')!, layer, left, top, false);
  return { name: layer.name, left, top, canvas, opacity: layer.opacity,
    hidden: !layer.visible, blendMode: 'normal' as const };
}

export async function exportPng(project: Project) {
  const canvas = await compositeCanvas(project);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG 编码失败')), 'image/png'));
  download(blob, `${safeFilename(project.title)}.png`);
}
export async function exportPsd(project: Project) {
  // PSD encoding holds several uncompressed canvases in browser memory.
  if (project.width * project.height > 30_000_000 ||
      project.layers.reduce((sum, l) => sum + l.width * l.height, 0) > 80_000_000) {
    throw new Error('项目图像体积过大，可能超出浏览器内存。请先缩小画布或图层尺寸。');
  }
  const { writePsd } = await import('ag-psd');
  const children = [];
  for (const layer of project.layers) children.push(await rasterizedLayer(layer));
  const merged = await compositeCanvas(project);
  const buffer = writePsd({ width: project.width, height: project.height,
    colorMode: 3, bitsPerChannel: 8, canvas: merged, children } as Parameters<typeof writePsd>[0]);
  download(new Blob([buffer], { type: 'application/octet-stream' }), `${safeFilename(project.title)}.psd`);
}
export function exportProject(project: Project) {
  download(new Blob([JSON.stringify(project)], { type: 'application/json' }),
    `${safeFilename(project.title)}.layerforge.json`);
}
export async function importProject(file: File): Promise<Project> {
  const result: unknown = JSON.parse(await file.text());
  if (!validProject(result)) throw new Error('这不是有效的 LayerForge 项目文件（版本 1）');
  return result;
}

export type PsdImportResult = { project: Project; note: string };
export async function importPsd(file: File): Promise<PsdImportResult> {
  const { readPsd, getLayerCanvas, getCompositeCanvas } = await import('ag-psd');
  if (file.size > 150 * 1024 * 1024)
    throw new Error('PSD 文件超过 150MB，建议先在专业工具中缩小或合并无用图层');
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength < 26 || new TextDecoder().decode(buffer.slice(0, 4)) !== '8BPS')
    throw new Error('文件没有有效的 PSD 文件头');
  const header = new DataView(buffer);
  const heightHint = header.getUint32(14), widthHint = header.getUint32(18);
  if (widthHint > 12000 || heightHint > 12000 || widthHint * heightHint > 30_000_000)
    throw new Error('PSD 尺寸过大，超过网页编辑器的内存安全限制');
  const psd = readPsd(buffer, { skipThumbnail: true });
  const width = psd.width, height = psd.height;
  const layers: EditorLayer[] = [];
  let omitted = 0;
  // PSD children: top -> bottom. Flatten the visual pixel layers of nested groups.
  function walk(nodes: NonNullable<typeof psd.children>, prefix = '', parentHidden = false, parentOpacity = 1) {
    for (const node of nodes) {
      const label = prefix + (node.name || '未命名图层');
      const hidden = parentHidden || !!node.hidden;
      const opacity = clamp(parentOpacity * (node.opacity ?? 1), 0, 1);
      if (node.children?.length) {
        walk(node.children, `${label} / `, hidden, opacity);
        continue;
      }
      let canvas: HTMLCanvasElement | undefined;
      try { canvas = getLayerCanvas(node) as HTMLCanvasElement | undefined; }
      catch { canvas = node.canvas as HTMLCanvasElement | undefined; }
      if (!canvas || !canvas.width || !canvas.height) { omitted++; continue; }
      layers.push({ id: makeId(), type: 'image', name: label,
        src: canvas.toDataURL('image/png'), x: node.left ?? 0, y: node.top ?? 0,
        width: canvas.width, height: canvas.height, rotation: 0,
        visible: !hidden, locked: false, opacity });
    }
  }
  walk(psd.children ?? []);
  if (!layers.length) {
    const canvas = getCompositeCanvas(psd) as HTMLCanvasElement | undefined;
    if (!canvas) throw new Error('PSD 中没有可读取的位图图层或合成图。');
    layers.push({ id: makeId(), type: 'image', name: 'PSD 合成图（单层）',
      src: canvas.toDataURL('image/png'), x: 0, y: 0, width, height,
      rotation: 0, opacity: 1, visible: true, locked: false });
  }
  return { project: { version: 1, title: file.name.replace(/\.psd$/i, ''), width, height, layers },
    note: `已导入 ${layers.length} 个像素图层。${omitted ? `另有 ${omitted} 个不含可用位图的图层被跳过。` : ''} 蒙版、混合模式、智能对象与可编辑文字不会原样保留。` };
}
