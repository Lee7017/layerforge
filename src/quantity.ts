import { loadImage } from './io';
import { makeId } from './types';
import type { PictureLayer, QuantityLayout } from './types';

export type Point = { x: number; y: number };

/** Manual polygon cut-out: preserves alpha outside the traced outline. */
export async function cutOutBottle(source: PictureLayer, points: Point[]): Promise<PictureLayer> {
  if (points.length < 3) throw new Error('请至少标出三个轮廓点');
  if (source.rotation !== 0) throw new Error('请先将源图层旋转角度设为 0，再进行描边提取');
  const left = Math.max(source.x, Math.floor(Math.min(...points.map(p => p.x))));
  const top = Math.max(source.y, Math.floor(Math.min(...points.map(p => p.y))));
  const right = Math.min(source.x + source.width, Math.ceil(Math.max(...points.map(p => p.x))));
  const bottom = Math.min(source.y + source.height, Math.ceil(Math.max(...points.map(p => p.y))));
  if (right <= left || bottom <= top) throw new Error('描边范围不在源图片内');
  if ((right - left) * (bottom - top) > 12_000_000) throw new Error('选区太大，请缩小单瓶范围');
  const img = await loadImage(source.src);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, right - left);
  canvas.height = Math.max(1, bottom - top);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 Canvas');
  ctx.beginPath();
  points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x - left, p.y - top); else ctx.lineTo(p.x - left, p.y - top); });
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, source.x - left, source.y - top, source.width, source.height);
  return {
    id: makeId(), name: '单瓶素材（源图层，默认隐藏）', type: 'image', src: canvas.toDataURL('image/png'),
    x: left, y: top, width: canvas.width, height: canvas.height, rotation: 0,
    visible: false, locked: true, opacity: 1,
  };
}

/** Every generated bottle is a separate editable raster layer, not a merged grid. */
export function makeBottleGrid(sample: PictureLayer, layout: QuantityLayout): PictureLayer[] {
  const { rows, columns, originX, originY, itemWidth, itemHeight, gapX, gapY,
    rowShiftX, columnShiftY, rowScale, groupId } = layout;
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 || rows * columns > 120)
    throw new Error('瓶数须为 1～120（行数 × 列数）');
  const result: PictureLayer[] = [];
  // Front rows first (top of Photoshop stack), back rows later.
  for (let row = rows - 1; row >= 0; row--) {
    const scale = Math.pow(rowScale, row);
    const width = Math.max(1, Math.round(itemWidth * scale));
    const height = Math.max(1, Math.round(itemHeight * scale));
    for (let col = 0; col < columns; col++) {
      result.push({
        id: makeId(), name: `瓶 ${row + 1}-${col + 1}`, type: 'image', src: sample.src,
        x: Math.round(originX + col * (itemWidth + gapX) + row * rowShiftX + (itemWidth - width) / 2),
        y: Math.round(originY + row * (itemHeight + gapY) + col * columnShiftY),
        width, height, rotation: sample.rotation, opacity: 1, visible: true, locked: false,
        quantityGroupId: groupId,
      });
    }
  }
  return result;
}

export function newQuantityLayout(sample: PictureLayer): QuantityLayout {
  return {
    groupId: makeId(), sampleId: sample.id, rows: 4, columns: 5,
    originX: Math.round(sample.x), originY: Math.round(sample.y),
    itemWidth: sample.width, itemHeight: sample.height,
    gapX: Math.round(sample.width * 0.12), gapY: Math.round(sample.height * 0.12),
    rowShiftX: 0, columnShiftY: 0, rowScale: 1,
  };
}
