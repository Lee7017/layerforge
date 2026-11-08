export type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  quantityGroupId?: string; // Generated bottle identity for count checking
};
export type PictureLayer = LayerBase & { type: 'image'; src: string };
export type TextLayer = LayerBase & {
  type: 'text'; text: string; color: string; fontSize: number;
  fontFamily: string; bold: boolean;
};
export type ShapeLayer = LayerBase & {
  type: 'shape'; fill: string; radius: number;
};
export type EditorLayer = PictureLayer | TextLayer | ShapeLayer;
export type QuantityLayout = {
  groupId: string; sampleId: string; rows: number; columns: number;
  originX: number; originY: number; itemWidth: number; itemHeight: number;
  gapX: number; gapY: number; rowShiftX: number; columnShiftY: number; rowScale: number;
};
// layers[0] = topmost, same order as Photoshop's children array.
export type Project = {
  version: 1;
  title: string;
  width: number;
  height: number;
  layers: EditorLayer[];
  quantity?: QuantityLayout; // Optional; older project JSON remains compatible
};
export const makeId = () => crypto.randomUUID();
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function createDemo(): Project {
  const base = { rotation: 0, opacity: 1, visible: true, locked: false };
  return {
    version: 1, title: '我的分层设计', width: 1200, height: 800,
    layers: [
      { ...base, id: makeId(), type: 'text', name: '主标题', text: '创意，由你掌控。', color: '#ffffff',
        fontSize: 94, fontFamily: 'sans-serif', bold: true, x: 75, y: 264, width: 1060, height: 140 },
      { ...base, id: makeId(), type: 'text', name: '说明文字', text: '导入透明 PNG 或 PSD，拖动每个图层，自由排版。', color: '#c7c9e4',
        fontSize: 32, fontFamily: 'sans-serif', bold: false, x: 82, y: 442, width: 970, height: 60 },
      { ...base, id: makeId(), type: 'text', name: '角标文字', text: 'LAYERFORGE  /  PSD EDITOR', color: '#10111d',
        fontSize: 25, fontFamily: 'sans-serif', bold: true, x: 105, y: 119, width: 600, height: 38 },
      { ...base, id: makeId(), type: 'shape', name: '角标底色', fill: '#aeffa4', radius: 22,
        x: 80, y: 106, width: 550, height: 64 },
      { ...base, id: makeId(), type: 'shape', name: '右侧强调色块', fill: '#6a57e8', radius: 110,
        x: 935, y: 515, width: 340, height: 340, rotation: -18 },
      { ...base, id: makeId(), type: 'shape', name: '底部装饰', fill: '#353665', radius: 60,
        x: 79, y: 633, width: 780, height: 22 },
      { ...base, id: makeId(), type: 'shape', name: '背景', fill: '#191a35', radius: 0,
        x: 0, y: 0, width: 1200, height: 800, locked: true },
    ],
  };
}

export function validProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.title !== 'string' ||
      !Number.isInteger(v.width) || !Number.isInteger(v.height) ||
      (v.width as number) < 1 || (v.height as number) < 1 ||
      (v.width as number) > 12000 || (v.height as number) > 12000 ||
      !Array.isArray(v.layers) || v.layers.length > 500) return false;
  if (v.quantity !== undefined) {
    if (!v.quantity || typeof v.quantity !== 'object') return false;
    const q = v.quantity as Record<string, unknown>;
    if (typeof q.groupId !== 'string' || typeof q.sampleId !== 'string' ||
        !['rows', 'columns', 'originX', 'originY', 'itemWidth', 'itemHeight', 'gapX', 'gapY', 'rowShiftX', 'columnShiftY', 'rowScale']
          .every(k => typeof q[k] === 'number' && Number.isFinite(q[k]))) return false;
    if (!Number.isInteger(q.rows) || !Number.isInteger(q.columns) ||
        (q.rows as number) < 1 || (q.columns as number) < 1 || (q.rows as number) * (q.columns as number) > 120 ||
        (q.itemWidth as number) < 1 || (q.itemHeight as number) < 1 ||
        (q.rowScale as number) < .5 || (q.rowScale as number) > 1.5) return false;
  }
  return v.layers.every((layer: unknown) => {
    if (!layer || typeof layer !== 'object') return false;
    const x = layer as Record<string, unknown>;
    if (!['image', 'text', 'shape'].includes(String(x.type)) ||
        typeof x.id !== 'string' || typeof x.name !== 'string' ||
        typeof x.visible !== 'boolean' || typeof x.locked !== 'boolean' ||
        !['x', 'y', 'width', 'height', 'rotation', 'opacity'].every(k => typeof x[k] === 'number' && Number.isFinite(x[k])) ||
        (x.width as number) <= 0 || (x.height as number) <= 0 ||
        (x.width as number) > 30000 || (x.height as number) > 30000 ||
        (x.opacity as number) < 0 || (x.opacity as number) > 1) return false;
    if (x.quantityGroupId !== undefined && typeof x.quantityGroupId !== 'string') return false;
    if (x.type === 'image') return typeof x.src === 'string' && /^data:image\//.test(x.src);
    if (x.type === 'text') return typeof x.text === 'string' && typeof x.color === 'string' &&
      typeof x.fontFamily === 'string' && typeof x.fontSize === 'number' && Number.isFinite(x.fontSize) &&
      x.fontSize > 0 && typeof x.bold === 'boolean';
    return typeof x.fill === 'string' && typeof x.radius === 'number' && Number.isFinite(x.radius);
  });
}
