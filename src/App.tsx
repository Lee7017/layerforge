import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import Konva from 'konva';
import { Stage, Layer as KonvaLayer, Rect, Image as KonvaImage, Text as KonvaText, Transformer, Line, Circle } from 'react-konva';
import { clamp, createDemo, makeId, validProject } from './types';
import type { EditorLayer, PictureLayer, Project, QuantityLayout, ShapeLayer, TextLayer } from './types';
import { exportPng, exportPsd, exportProject, fileToDataUrl, imageFilesToLayers, importProject, importPsd, loadImage } from './io';
import { readSession, writeSession } from './storage';
import { cutOutBottle, makeBottleGrid, newQuantityLayout } from './quantity';
import { createPackagingFallback } from './packagingExample';
import type { Point } from './quantity';

const zoomOptions = [.25, .4, .5, .65, .8, 1, 1.25, 1.5, 2];

// Bundled example is part of the static GitHub Pages build. No PSD upload needed.
async function loadPackagingExample(): Promise<Project> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}examples/chemical-packaging-20.json`);
    if (response.ok) {
      const data: unknown = await response.json();
      if (validProject(data)) return data;
    }
  } catch { /* In offline/local previews, fall back to the illustrated project. */ }
  return createPackagingFallback();
}
type CanvasObjectProps = {
  layer: EditorLayer;
  selected: boolean;
  tracing: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<EditorLayer>) => void;
};

function CanvasObject({ layer, selected, tracing, onSelect, onChange }: CanvasObjectProps) {
  const nodeRef = useRef<Konva.Node | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (layer.type !== 'image') { setImage(null); return; }
    let active = true;
    loadImage(layer.src).then(img => { if (active) setImage(img); }).catch(() => {});
    return () => { active = false; };
  }, [layer.type === 'image' ? layer.src : '']);
  useEffect(() => {
    if (selected && nodeRef.current && trRef.current) {
      trRef.current.nodes([nodeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected, layer.type]);
  if (!layer.visible) return null;
  const common = {
    x: layer.x, y: layer.y, width: layer.width, height: layer.height,
    rotation: layer.rotation, opacity: layer.opacity,
    draggable: !layer.locked && !tracing, listening: !layer.locked && !tracing,
    onClick: () => onSelect(layer.id),
    onTap: () => onSelect(layer.id),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onChange(layer.id, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) });
    },
    onTransformEnd: () => {
      const node = nodeRef.current;
      if (!node) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const patch: Partial<EditorLayer> = {
        x: Math.round(node.x()), y: Math.round(node.y()), rotation: Math.round(node.rotation() * 10) / 10,
        width: Math.max(1, Math.round(layer.width * scaleX)),
        height: Math.max(1, Math.round(layer.height * scaleY)),
      };
      node.scaleX(1); node.scaleY(1);
      onChange(layer.id, patch);
    },
  };
  return <>
    {layer.type === 'image' ?
      <KonvaImage {...common} image={image ?? undefined} ref={nodeRef as Ref<Konva.Image>} /> :
      layer.type === 'shape' ?
        <Rect {...common} fill={layer.fill} cornerRadius={Math.min(layer.radius, layer.width / 2, layer.height / 2)} ref={nodeRef as Ref<Konva.Rect>} /> :
        <KonvaText {...common} text={layer.text} fontFamily={layer.fontFamily} fontSize={layer.fontSize}
          fontStyle={layer.bold ? 'bold' : 'normal'} fill={layer.color} lineHeight={1.2}
          wrap="char" ref={nodeRef as Ref<Konva.Text>} />}
    {selected && !layer.locked && !tracing &&
      <Transformer ref={trRef} rotateEnabled enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
        keepRatio={layer.type === 'image'} flipEnabled={false} borderStroke="#a6ff94" anchorFill="#a6ff94" anchorStroke="#26253f"
        anchorSize={10} rotateAnchorOffset={24} boundBoxFunc={(_old, next) =>
          next.width < 5 || next.height < 5 ? _old : next} />}
  </>;
}

function NumberControl({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (value: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return <label className="field"><span>{label}</span>
    <input type="number" value={Number.isInteger(value) ? value : Number(value.toFixed(2))}
      min={min} max={max} step={step}
      onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) onChange(clamp(v, min ?? -100000, max ?? 100000)); }} />
  </label>;
}

const C = ({ children }: { children: ReactNode }) => <span className="glyph">{children}</span>;

export default function App() {
  const [project, setProject] = useState<Project>(() => createDemo());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(.65);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('欢迎使用！将透明 PNG 拖入中间画布，或使用左上角打开 PSD。');
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalInputRef = useRef<HTMLInputElement>(null);
  const [quantityPanel, setQuantityPanel] = useState(false);
  const [tracing, setTracing] = useState(false);
  const [outline, setOutline] = useState<Point[]>([]);
  const [traceSourceId, setTraceSourceId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<Project[]>([]);
  const redoStack = useRef<Project[]>([]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const savedProject = await readSession();
        if (!active) return;
        if (savedProject) {
          setProject(savedProject);
          setQuantityPanel(Boolean(savedProject.quantity));
          setNotice('已恢复上次在此浏览器编辑的项目；如需重新打开包装图集，请点击顶部「20瓶模板」。');
        } else {
          const example = await loadPackagingExample();
          if (!active) return;
          setProject(example);
          setQuantityPanel(true);
          setZoom(.5);
          setNotice(example.title.includes('结构示意') ? '已自动打开包装数量精修示意图（并非上一版照片 PSD）。已有 20 个独立瓶子图层；可直接修改并导出 PSD。' : '已自动打开原图包装模板：5列×4排，20个独立瓶子图层；无需导入 PSD。');
        }
      } catch (err) {
        if (active) setNotice(`模板加载失败，仍可手动导入素材：${err instanceof Error ? err.message : String(err)}`);
      } finally { if (active) setReady(true); }
    };
    void initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      writeSession(project).then(() => setSaved(true))
        .catch(() => { setSaved(false); setNotice('浏览器自动保存空间不足，请点击「保存项目」下载 JSON 备份。'); });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [project, ready]);

  const commit = useCallback((next: Project) => {
    if (next === project) return;
    undoStack.current = [...undoStack.current.slice(-59), project];
    redoStack.current = [];
    setProject(next);
  }, [project]);
  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(project);
    setProject(prev);
  }, [project]);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(project);
    setProject(next);
  }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,[contenteditable=true]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape' && tracing) { e.preventDefault(); setTracing(false); setOutline([]); return; }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault(); (e.shiftKey ? redo : undo)();
      } else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        const current = project.layers.find(l => l.id === selectedId);
        if (current && !current.locked) {
          commit({ ...project, layers: project.layers.filter(l => l.id !== selectedId) }); setSelectedId(null);
        }
      } else if (selectedId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const layer = project.layers.find(l => l.id === selectedId);
        if (!layer || layer.locked) return;
        e.preventDefault();
        const n = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0;
        const dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
        commit({ ...project, layers: project.layers.map(l => l.id === selectedId ? { ...l, x: l.x + dx, y: l.y + dy } : l) });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [project, selectedId, commit, undo, redo, tracing]);

  const reopenExample = async () => {
    if (busy) return;
    if (!window.confirm('重新打开内置 20 瓶包装图集会替换当前编辑内容。需要保留修改请先点「保存项目」。继续吗？')) return;
    setBusy(true);
    try {
      const example = await loadPackagingExample();
      commit(example);
      setSelectedId(null);
      setQuantityPanel(true);
      setTracing(false);
      setOutline([]);
      setZoom(.5);
      setNotice(example.title.includes('结构示意') ? '已打开内置 20 瓶示意图。20 个瓶子可直接编辑；原照片 PSD 尚未上传至仓库。' : '已打开原图包装图集，可直接编辑 20 个独立瓶子图层并导出 PSD。');
    } catch (err) { setNotice(`打开内置模板失败：${err instanceof Error ? err.message : String(err)}`); }
    finally { setBusy(false); }
  };
  const selected = project.layers.find(l => l.id === selectedId) ?? null;
  const layout = project.quantity;
  const sample = (project.layers.find(l => l.id === layout?.sampleId && l.type === 'image') ?? null) as PictureLayer | null;
  const gridLayers = layout ? project.layers.filter(l => l.quantityGroupId === layout.groupId) : [];
  const visibleCount = gridLayers.filter(l => l.visible).length;
  const expectedCount = layout ? layout.rows * layout.columns : 0;
  const patchLayout = (patch: Partial<QuantityLayout>) => {
    if (!layout) return;
    const next = { ...layout, ...patch };
    if (next.rows * next.columns > 120) { setNotice('一次最多排列 120 瓶，请先减少行数或列数。'); return; }
    commit({ ...project, quantity: next });
  };
  const useSelectedSample = () => {
    if (!selected || selected.type !== 'image') {
      setNotice('请先选中一张独立的单瓶 PNG 图片图层。'); return;
    }
    if (!window.confirm('将选中图片作为单瓶模板并隐藏它，之后可一键排列 20 瓶。请确认这张图片仅含一瓶（最好透明背景），不是整张装箱图。')) return;
    const nextLayout = newQuantityLayout(selected);
    commit({ ...project,
      layers: project.layers.filter(l => l.quantityGroupId !== layout?.groupId)
        .map(l => l.id === selected.id ? { ...l, visible: false, locked: true } : l),
      quantity: nextLayout,
    });
    setQuantityPanel(true);
    setNotice('已设为单瓶模板。设置行数、列数和起点，再点击「生成瓶阵」。');
  };
  const beginTrace = () => {
    if (!selected || selected.type !== 'image') { setNotice('请先从左侧图层列表中选中要提取单瓶的原始图片。'); return; }
    if (selected.rotation !== 0) { setNotice('请先将源图层旋转角度设置为 0。'); return; }
    setTraceSourceId(selected.id); setOutline([]); setTracing(true); setNotice('描边模式：沿单瓶外轮廓逐点点击。至少 3 个点，然后点击「完成提取」；按 Esc 可取消。');
  };
  const finishTrace = async () => {
    const source = project.layers.find(l => l.id === traceSourceId);
    if (!source || source.type !== 'image') { setTracing(false); setNotice('源图层不存在'); return; }
    try {
      const bottle = await cutOutBottle(source, outline);
      const nextLayout = newQuantityLayout(bottle);
      commit({ ...project, layers: [bottle, ...project.layers.filter(l => l.quantityGroupId !== layout?.groupId)], quantity: nextLayout });
      setSelectedId(null); setTracing(false); setOutline([]); setTraceSourceId(null);
      setNotice('已经沿描边提取单瓶，并作为隐藏素材保存。请调整瓶阵起点和间距；原图里的旧瓶子还需要另行遮盖或替换底图。');
    } catch (err) { setNotice(`提取失败：${err instanceof Error ? err.message : String(err)}`); }
  };
  const applyGrid = () => {
    if (!layout || !sample) { setNotice('请先设置一个单瓶模板。'); return; }
    if (gridLayers.length > 0 && !window.confirm('重新生成会覆盖当前瓶阵里每个瓶子的手动位置调整。继续吗？')) return;
    try {
      const generated = makeBottleGrid(sample, layout);
      const remainder = project.layers.filter(l => l.quantityGroupId !== layout.groupId);
      commit({ ...project, layers: [...generated, ...remainder] });
      setSelectedId(generated[0]?.id ?? null);
      setNotice(`已生成 ${generated.length} 个独立瓶子图层（${layout.columns} 列 × ${layout.rows} 排），可以逐个拖动。`);
    } catch (err) { setNotice(`生成失败：${err instanceof Error ? err.message : String(err)}`); }
  };
  const importOriginal = async (file: File) => {
    setBusy(true);
    try {
      if (!/^image\/(png|jpeg|webp)/i.test(file.type)) throw new Error('请上传 PNG、JPG 或 WebP 原图');
      const src = await fileToDataUrl(file);
      const img = await loadImage(src);
      if (img.naturalWidth * img.naturalHeight > 30_000_000) throw new Error('原图超过 3000 万像素，请先缩小');
      if (!window.confirm('以这张 AI 图片创建新画布？当前画布可以先下载 JSON 备份，再继续。')) return;
      const background: PictureLayer = {
        type: 'image', id: makeId(), name: 'AI 原图（可锁定）', src, x: 0, y: 0,
        width: img.naturalWidth, height: img.naturalHeight, rotation: 0, opacity: 1,
        visible: true, locked: true,
      };
      const next: Project = { version: 1, title: file.name.replace(/\.[^.]+$/, ''),
        width: img.naturalWidth, height: img.naturalHeight, layers: [background] };
      commit(next); setSelectedId(background.id); setOutline([]); setTracing(false); setQuantityPanel(true);
      setNotice('AI 原图已设为画布。右侧进入数量精修：可以选中原图并描边提取单瓶。');
    } catch (err) { setNotice(`打开原图失败：${err instanceof Error ? err.message : String(err)}`); }
    finally { setBusy(false); if (originalInputRef.current) originalInputRef.current.value = ''; }
  };
  const patchLayer = (id: string, patch: Partial<EditorLayer>) => {
    const current = project.layers.find(l => l.id === id);
    if (!current) return;
    commit({ ...project, layers: project.layers.map(l => l.id === id ? { ...l, ...patch } as EditorLayer : l) });
  };
  const addShape = () => {
    const s: ShapeLayer = { type: 'shape', id: makeId(), name: '矩形', x: project.width * .25, y: project.height * .27,
      width: project.width * .35, height: project.height * .23, rotation: 0, opacity: 1,
      visible: true, locked: false, fill: '#a6ff94', radius: 24 };
    commit({ ...project, layers: [s, ...project.layers] }); setSelectedId(s.id);
  };
  const addText = () => {
    const t: TextLayer = { type: 'text', id: makeId(), name: '文字', x: project.width * .2, y: project.height * .35,
      width: project.width * .65, height: 120, rotation: 0, opacity: 1, visible: true, locked: false,
      text: '双击右侧文字框进行编辑', color: '#ffffff', fontSize: 58, fontFamily: 'sans-serif', bold: true };
    commit({ ...project, layers: [t, ...project.layers] }); setSelectedId(t.id);
  };
  const duplicate = () => {
    if (!selected) return;
    const cloned: EditorLayer = { ...selected, id: makeId(), name: selected.name + ' 副本', x: selected.x + 28, y: selected.y + 28 };
    const index = project.layers.findIndex(l => l.id === selected.id);
    const layers = [...project.layers]; layers.splice(index, 0, cloned);
    commit({ ...project, layers }); setSelectedId(cloned.id);
  };
  const remove = () => {
    if (!selected || selected.locked) return;
    commit({ ...project, layers: project.layers.filter(l => l.id !== selected.id) }); setSelectedId(null);
  };
  const reorder = (source: string, destination: string) => {
    if (source === destination) return;
    const layers = [...project.layers];
    const from = layers.findIndex(l => l.id === source);
    const to = layers.findIndex(l => l.id === destination);
    if (from < 0 || to < 0) return;
    const [moved] = layers.splice(from, 1);
    layers.splice(to, 0, moved);
    commit({ ...project, layers });
  };

  const processFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const psdFile = files.find(f => /\.psd$/i.test(f.name));
      const jsonFile = files.find(f => /\.json$/i.test(f.name));
      let next = project;
      if (psdFile) {
        const result = await importPsd(psdFile);
        next = result.project;
        setNotice(result.note);
        setSelectedId(null);
      } else if (jsonFile) {
        next = await importProject(jsonFile);
        setNotice(`已打开项目：${next.title}`);
        setSelectedId(null);
      }
      const images = files.filter(f => f.type.startsWith('image/'));
      if (images.length) {
        const added = await imageFilesToLayers(images, next);
        next = { ...next, layers: [...added.reverse(), ...next.layers] };
        setSelectedId(added[0]?.id ?? null);
        setNotice(`成功加入 ${images.length} 张图片。素材以独立图层保留，可直接拖动。`);
      }
      if (next !== project) { commit(next); setTracing(false); setOutline([]); }
      else if (!images.length && !psdFile && !jsonFile) throw new Error('请导入 PSD、项目 JSON 或图片文件');
    } catch (err) { setNotice(`操作失败：${err instanceof Error ? err.message : String(err)}`); }
    finally { setBusy(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const runExport = async (format: 'png' | 'psd' | 'json') => {
    if (format !== 'json' && layout && gridLayers.length !== expectedCount) {
      setNotice(`数量检查未通过：设置的是 ${expectedCount} 瓶，实际瓶阵有 ${gridLayers.length} 个图层。请点击「生成/更新瓶阵」。`);
      return;
    }
    if (format !== 'json' && layout && visibleCount !== expectedCount) {
      setNotice(`数量检查未通过：目标 ${expectedCount} 瓶，目前只有 ${visibleCount} 瓶可见。请显示被隐藏的瓶子或重新生成。`);
      return;
    }
    setBusy(true); setNotice(`正在导出 ${format.toUpperCase()}…`);
    try {
      if (format === 'png') await exportPng(project);
      else if (format === 'psd') await exportPsd(project);
      else exportProject(project);
      setNotice(`${format.toUpperCase()} 已生成并开始下载。PSD 内各图层为独立位图。`);
    } catch (err) { setNotice(`导出失败：${err instanceof Error ? err.message : String(err)}`); }
    finally { setBusy(false); }
  };
  const fitToWindow = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const ratio = Math.min((viewport.clientWidth - 110) / project.width, (viewport.clientHeight - 110) / project.height);
    setZoom(clamp(Math.round(ratio * 100) / 100, .1, 2));
  };

  return <div className="app">
    <input ref={originalInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp"
      onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void importOriginal(file); }} />
    <input ref={fileInputRef} className="sr-only" type="file" multiple
      accept=".psd,.json,image/png,image/jpeg,image/webp,image/gif"
      onChange={e => void processFiles(Array.from(e.currentTarget.files ?? []))} />
    <header className="topbar">
      <div className="brand"><span className="brand-mark">◈</span><div><strong>LayerForge</strong><small>分层画布</small></div></div>
      <div className="top-actions">
        <button className="button primary" disabled={busy || !ready} onClick={() => void reopenExample()}><C>▣</C> 20瓶包装图集</button>
        <button className="button" disabled={busy} onClick={() => fileInputRef.current?.click()}><C>＋</C> 导入 PSD / 图片</button>
        <button className={`button ${quantityPanel ? 'success' : ''}`} onClick={() => { setQuantityPanel(v => !v); setTracing(false); setOutline([]); }}>▦ 数量精修</button>
        <span className="line" />
        <button className="button" disabled={busy} onClick={() => void runExport('json')}>保存项目</button>
        <button className="button" disabled={busy} onClick={() => void runExport('png')}>导出 PNG</button>
        <button className="button success" disabled={busy} onClick={() => void runExport('psd')}>↧ 导出 PSD</button>
      </div>
    </header>
    <div className="body">
      <aside className="sidebar leftbar">
        <div className="side-heading"><span>图层</span><span className="count">{project.layers.length}</span></div>
        <div className="add-actions">
          <button onClick={addText}>T 文字</button><button onClick={addShape}>▢ 矩形</button>
        </div>
        <p className="hint">内置示例已经逐瓶分层，点击单瓶即可拖动。新素材仍可导入 PSD / PNG。</p>
        <div className="layer-list">
          {project.layers.map(layer => <div key={layer.id}
            className={`layer-row ${selectedId === layer.id ? 'active' : ''} ${!layer.visible ? 'muted' : ''}`}
            draggable
            onDragStart={e => { e.dataTransfer.setData('application/x-layerforge-layer', layer.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={e => { if (e.dataTransfer.types.includes('application/x-layerforge-layer')) e.preventDefault(); }}
            onDrop={e => { const id = e.dataTransfer.getData('application/x-layerforge-layer'); if (id) { e.preventDefault(); e.stopPropagation(); reorder(id, layer.id); } }}
            onClick={() => setSelectedId(layer.id)}>
            <span className="drag-handle" title="拖动以调整层级">⠿</span>
            <span className="layer-icon">{layer.type === 'text' ? 'T' : layer.type === 'shape' ? '▢' : '▧'}</span>
            <span className="layer-title" title={layer.name}>{layer.name}</span>
            <button title={layer.locked ? '解锁' : '锁定'} aria-label="切换锁定"
              onClick={e => { e.stopPropagation(); patchLayer(layer.id, { locked: !layer.locked }); }}>{layer.locked ? '🔒' : '♧'}</button>
            <button title={layer.visible ? '隐藏' : '显示'} aria-label="切换可见"
              onClick={e => { e.stopPropagation(); patchLayer(layer.id, { visible: !layer.visible }); }}>{layer.visible ? '◉' : '○'}</button>
          </div>)}
        </div>
        <div className="sidebar-bottom">
          <button className="button full" disabled={!selected} onClick={duplicate}>⧉ 复制图层</button>
          <button className="button full subtle-danger" disabled={!selected || selected.locked} onClick={remove}>删除选中图层</button>
          <p className="hint">层级从上至下排列。按 Delete 删除；Ctrl/Cmd + Z 撤销。</p>
        </div>
      </aside>
      <main className="workspace">
        <div className="work-toolbar">
          <div className="project-title"><input aria-label="项目名称" value={project.title}
            onChange={e => commit({ ...project, title: e.target.value })} />
            <span>· {project.width} × {project.height} px</span></div>
          <div className="zoom-controls">
            <button disabled={!undoStack.current.length} title="撤销" onClick={undo}>↶</button>
            <button disabled={!redoStack.current.length} title="重做" onClick={redo}>↷</button>
            <span className="line" />
            <button onClick={() => setZoom(z => clamp(z - .1, .1, 2))}>－</button>
            <select aria-label="缩放比例" value={zoomOptions.includes(zoom) ? zoom : 'other'}
              onChange={e => { if (e.target.value !== 'other') setZoom(Number(e.target.value)); }}>
              {!zoomOptions.includes(zoom) && <option value="other">{Math.round(zoom * 100)}%</option>}
              {zoomOptions.map(z => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
            </select>
            <button onClick={() => setZoom(z => clamp(z + .1, .1, 2))}>＋</button>
            <button onClick={fitToWindow} title="适配屏幕">适应</button>
          </div>
        </div>
        <div ref={viewportRef} className="viewport"
          onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); void processFiles([...e.dataTransfer.files]); } }}>
          <div className="canvas-centering">
            <div className="canvas-board" style={{ width: project.width * zoom, height: project.height * zoom }}>
              <Stage width={project.width * zoom} height={project.height * zoom} scaleX={zoom} scaleY={zoom}
                onMouseDown={e => {
                  if (tracing) { const pos = e.target.getStage()?.getPointerPosition();
                    if (pos) setOutline(points => [...points, { x: Math.round(pos.x / zoom), y: Math.round(pos.y / zoom) }]);
                  } else if (e.target === e.target.getStage()) setSelectedId(null);
                }}
                onTouchStart={e => {
                  if (tracing) { const pos = e.target.getStage()?.getPointerPosition();
                    if (pos) setOutline(points => [...points, { x: Math.round(pos.x / zoom), y: Math.round(pos.y / zoom) }]);
                  } else if (e.target === e.target.getStage()) setSelectedId(null);
                }}>
                <KonvaLayer>
                  {[...project.layers].reverse().map(layer => <CanvasObject key={layer.id} layer={layer}
                    selected={selectedId === layer.id} tracing={tracing} onSelect={setSelectedId} onChange={patchLayer} />)}
                  {tracing && outline.length > 0 && <>
                    <Line points={outline.flatMap(p => [p.x, p.y])} closed={outline.length > 2}
                      stroke="#a6ff94" strokeWidth={2 / zoom} dash={[6 / zoom, 3 / zoom]}
                      fill="rgba(166,255,148,.12)" listening={false} />
                    {outline.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={4 / zoom}
                      fill="#a6ff94" stroke="#1c2030" strokeWidth={1 / zoom} listening={false} />)}
                  </>}
                </KonvaLayer>
              </Stage>
            </div>
          </div>
        </div>
        <div className="statusbar"><span className="status-dot" />{busy ? '处理中…' : notice}<span className="autosave">{saved ? '● 已自动保存' : '○ 未保存'}</span></div>
      </main>
      <aside className="sidebar properties">
        <div className="side-heading"><span>{quantityPanel ? '数量精修' : '属性'}</span><span className="tiny">{quantityPanel ? '瓶数控制' : '编辑器'}</span></div>
        {quantityPanel ? <div className="quantity-panel">
          <div className="property-section"><h3>① 打开 AI 成品图</h3>
            <button className="button full" disabled={busy} onClick={() => originalInputRef.current?.click()}>上传原图并建立画布</button>
            <p className="small-help">如果已经导入 PSD，也可以直接选中其中的图片图层。</p>
          </div>
          <div className="property-section"><h3>② 提取一只瓶子</h3>
            <button className="button full" disabled={!selected || selected.type !== 'image' || tracing} onClick={beginTrace}>从选中图片描边提取单瓶</button>
            {tracing && <><p className="small-help accent">在画布上依次点击瓶子轮廓（当前 {outline.length} 点）。</p>
              <div className="quantity-row"><button className="button" disabled={!outline.length} onClick={() => setOutline(v => v.slice(0,-1))}>撤销一个点</button>
                <button className="button success" disabled={outline.length < 3} onClick={() => void finishTrace()}>完成提取</button></div>
              <button className="button full" onClick={() => { setTracing(false); setOutline([]); }}>取消描边</button></>}
            <div className="small-help">也可以导入已经抠好透明背景的单瓶 PNG，选中后直接设置为模板。</div>
            <button className="button full" disabled={!selected || selected.type !== 'image' || tracing} onClick={useSelectedSample}>使用选中图片作为单瓶模板</button>
            {sample && <div className="sample-indicator">✓ 单瓶模板：{sample.name}</div>}
          </div>
          <div className="property-section"><h3>③ 精确设置瓶数</h3>
            {layout ? <>
              <div className="field-grid">
                <NumberControl label="列数" value={layout.columns} min={1} max={120} onChange={columns => patchLayout({ columns: Math.round(columns) })}/>
                <NumberControl label="排数" value={layout.rows} min={1} max={120} onChange={rows => patchLayout({ rows: Math.round(rows) })}/>
              </div>
              <div className="quantity-total">目标 <strong>{expectedCount}</strong> 瓶 <span>{layout.columns} × {layout.rows}</span></div>
              <div className="field-grid">
                <NumberControl label="起点 X" value={layout.originX} onChange={originX => patchLayout({originX})}/>
                <NumberControl label="起点 Y" value={layout.originY} onChange={originY => patchLayout({originY})}/>
                <NumberControl label="单瓶宽" value={layout.itemWidth} min={1} max={12000} onChange={itemWidth => patchLayout({itemWidth})}/>
                <NumberControl label="单瓶高" value={layout.itemHeight} min={1} max={12000} onChange={itemHeight => patchLayout({itemHeight})}/>
                <NumberControl label="列间距" value={layout.gapX} min={-12000} onChange={gapX => patchLayout({gapX})}/>
                <NumberControl label="排间距" value={layout.gapY} min={-12000} onChange={gapY => patchLayout({gapY})}/>
                <NumberControl label="逐排横偏移" value={layout.rowShiftX} onChange={rowShiftX => patchLayout({rowShiftX})}/>
                <NumberControl label="逐列竖偏移" value={layout.columnShiftY} onChange={columnShiftY => patchLayout({columnShiftY})}/>
                <NumberControl label="每排缩放倍数" value={layout.rowScale} min={.5} max={1.5} step={.01} onChange={rowScale => patchLayout({rowScale})}/>
              </div>
              <button className="button success full" disabled={expectedCount > 120 || !sample} onClick={applyGrid}>生成 / 更新 {expectedCount} 个瓶子图层</button>
              <div className={`quantity-audit ${gridLayers.length === expectedCount && visibleCount === expectedCount ? 'ok' : 'warn'}`}>
                已生成 {gridLayers.length} 层 · 可见 {visibleCount} 瓶 · 目标 {expectedCount} 瓶
              </div>
              <p className="small-help">生成后可以逐瓶拖动。若调整行列数，需要点击「更新」才会改变图层。最多 120 瓶。</p>
            </> : <p className="small-help">先完成步骤②，才会出现数量和排列设置。</p>}
          </div>
          <div className="property-section"><h3>④ 修复原图、导出</h3>
            <p className="small-help">内置包装图集已包含箱体遮盖与 20 个瓶子图层；对其他 AI 图片，旧瓶子不会自动消失，需要另外修补背景和箱沿遮挡。</p>
            <p className="small-help">数量检查只统计本工具生成的瓶阵，不识别原图中剩余瓶子；导出前必须目视核对。</p>
            <button className="button full" onClick={() => setQuantityPanel(false)}>返回普通图层属性</button>
          </div>
        </div> : selected ? <>
          <div className="properties-title"><div className="property-badge">{selected.type === 'text' ? 'T' : selected.type === 'shape' ? '▢' : '▧'}</div>
            <div><strong>{selected.name}</strong><small>{selected.type === 'text' ? '文本图层' : selected.type === 'image' ? '图片图层' : '形状图层'}</small></div></div>
          <div className="property-section"><h3>图层名称</h3>
            <input className="wide-input" value={selected.name} onChange={e => patchLayer(selected.id, { name: e.target.value })} />
          </div>
          <div className="property-section"><h3>变换</h3>
            <div className="field-grid">
              <NumberControl label="X" value={selected.x} onChange={x => patchLayer(selected.id, { x })} />
              <NumberControl label="Y" value={selected.y} onChange={y => patchLayer(selected.id, { y })} />
              <NumberControl label="宽" min={1} value={selected.width} onChange={width => patchLayer(selected.id, { width })} />
              <NumberControl label="高" min={1} value={selected.height} onChange={height => patchLayer(selected.id, { height })} />
              <NumberControl label="旋转°" min={-360} max={360} value={selected.rotation} onChange={rotation => patchLayer(selected.id, { rotation })} />
            </div>
          </div>
          <div className="property-section"><h3>透明度 <span>{Math.round(selected.opacity * 100)}%</span></h3>
            <input className="slider" type="range" min={0} max={100} value={selected.opacity * 100}
              onChange={e => patchLayer(selected.id, { opacity: Number(e.target.value) / 100 })} />
          </div>
          {selected.type === 'text' && <div className="property-section"><h3>文字内容</h3>
            <textarea rows={5} className="wide-input" value={selected.text} onChange={e => patchLayer(selected.id, { text: e.target.value })} />
            <div className="field-grid"><NumberControl label="字号" min={1} max={900} value={selected.fontSize}
              onChange={fontSize => patchLayer(selected.id, { fontSize })} />
              <label className="field"><span>颜色</span><input type="color" value={selected.color} onChange={e => patchLayer(selected.id, { color: e.target.value })} /></label></div>
            <label className="check-field"><input type="checkbox" checked={selected.bold} onChange={e => patchLayer(selected.id, { bold: e.target.checked })} /> 粗体</label>
            <label className="field"><span>字体（本机安装）</span><select value={selected.fontFamily}
              onChange={e => patchLayer(selected.id, { fontFamily: e.target.value })}>
              <option value="sans-serif">默认无衬线</option><option value="serif">默认衬线</option>
              <option value="Arial">Arial</option><option value="Microsoft YaHei">微软雅黑</option>
              <option value="Noto Sans CJK SC">Noto Sans CJK</option></select></label>
          </div>}
          {selected.type === 'shape' && <div className="property-section"><h3>形状</h3>
            <label className="field"><span>填充颜色</span><input type="color" value={selected.fill}
              onChange={e => patchLayer(selected.id, { fill: e.target.value })} /></label>
            <NumberControl label="圆角半径" value={selected.radius} min={0} onChange={radius => patchLayer(selected.id, { radius })} />
          </div>}
          {selected.type === 'image' && <div className="property-section"><h3>替换图片</h3>
            <label className="upload-label">上传图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={async e => { const file = e.target.files?.[0]; if (!file) return;
                try { const src = await fileToDataUrl(file); const img = await loadImage(src);
                  patchLayer(selected.id, { src, width: img.naturalWidth, height: img.naturalHeight } as Partial<EditorLayer>); }
                catch (err) { setNotice(String(err)); } e.target.value = ''; }} /></label>
          </div>}
        </> : <div className="no-selection"><div className="empty-icon">◎</div>
          <strong>未选中图层</strong><p>在左边图层列表中选择，或直接点击画布元素。</p>
          <div className="property-section"><h3>画布尺寸</h3><div className="field-grid">
            <NumberControl label="宽" min={1} max={12000} value={project.width} onChange={width => commit({ ...project, width: Math.round(width) })} />
            <NumberControl label="高" min={1} max={12000} value={project.height} onChange={height => commit({ ...project, height: Math.round(height) })} />
          </div></div>
          <button className="button full" onClick={() => { if (window.confirm('新建画布会替换当前内容。建议先保存 JSON 项目，继续吗？')) {
            undoStack.current = []; redoStack.current = []; setProject(createDemo()); setSelectedId(null); } }}>创建示例画布</button>
        </div>}
        <div className="property-footnote">浏览器本地处理 · 文件不会上传到服务器。<br />PSD 导入后以像素图层编辑；文字和特效可能无法原样保留。</div>
      </aside>
    </div>
  </div>;
}