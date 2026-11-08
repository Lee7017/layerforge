import { makeId } from './types';
import type { PictureLayer, Project } from './types';

/** Browser-only editable starter; illustrated panels, not a faithful photo import. */
export function createPackagingFallback(): Project {
  const canvas = (w: number, h: number) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); if (!g) throw new Error('Canvas is unavailable');
    return { c, g };
  };
  const raster = (name: string, c: HTMLCanvasElement, x: number, y: number, locked = false): PictureLayer => ({
    id: makeId(), type: 'image', name, src: c.toDataURL('image/png'), x, y,
    width: c.width, height: c.height, rotation: 0, opacity: 1, visible: true, locked,
  });
  const bg = canvas(2048, 1070);
  bg.g.fillStyle = '#f3f7f2'; bg.g.fillRect(0, 0, 2048, 1070);
  bg.g.fillStyle = '#293d34'; bg.g.font = 'bold 29px sans-serif';
  bg.g.fillText('化工包装图集 · 数量精修示意', 123, 75);
  bg.g.fillStyle = '#71887b'; bg.g.font = '20px sans-serif';
  bg.g.fillText('可拖动图层 · 20 瓶（5 列 × 4 排） · 支持 PSD 导出', 123, 111);

  const layout: Array<[number, number, string]> = [
    [133, 146, '单品特写'], [738, 146, '装箱结构'], [1343, 146, '外箱陈列'],
    [133, 551, '码垛陈列'], [738, 551, '托盘物流'],
  ];
  const cards = layout.map(([x,y,title], index) => {
    const { c,g } = canvas(582, 382);
    g.fillStyle = '#fbfdfa'; g.fillRect(0,0,582,382);
    g.fillStyle = '#f0f3ef'; g.fillRect(2,2,578,321);
    g.strokeStyle = '#dae5da'; g.strokeRect(1,1,580,380);
    g.fillStyle = '#293e33'; g.font = 'bold 22px sans-serif'; g.fillText(title, 20,355);
    if (index===0) {
      for(let i=0;i<2;i++) {
        const bx=130+i*185;
        g.fillStyle='#ffffff'; g.strokeStyle='#c7cfcd'; g.lineWidth=3;
        g.beginPath(); g.roundRect(bx,75,103,195,18);g.fill();g.stroke();
        g.fillStyle='#e7eae6';g.fillRect(bx+23,54,56,27);
        g.fillStyle='#367ca5';g.fillRect(bx+12,145,79,73);
      }
    } else {
      const box=(bx:number,by:number,w:number,h:number) => {
        g.fillStyle='#c99052';g.fillRect(bx,by,w,h);g.strokeStyle='#9d6b3c';g.strokeRect(bx,by,w,h);
        g.fillStyle='#e3b681';g.beginPath();
        g.moveTo(bx,by);g.lineTo(bx+32,by-30);g.lineTo(bx+w+28,by-30);g.lineTo(bx+w,by);g.closePath();g.fill();
        g.fillStyle='#523c28';g.font='bold 15px sans-serif';g.fillText('500ml × 20瓶',bx+25,by+h/2);
      };
      if(index===1) {
        box(90,100,397,215);
        g.fillStyle='#925e35';g.fillRect(126,126,326,142);
        g.fillStyle='#b9824e';g.fillRect(133,135,310,130);
      } else if(index===2) box(110,110,360,160);
      else {
        g.fillStyle='#ae8b68';g.fillRect(110,280,350,19);
        for(let row=0;row<3;row++) for(let col=0;col<4;col++)
          box(120+col*85,242-row*49,77,46);
      }
    }
    return raster((index+1)+'｜'+title+'（示意模块）',c,x,y);
  });
  const cap=canvas(25,25);
  const gradient=cap.g.createRadialGradient(9,8,1,12,12,12);
  gradient.addColorStop(0,'#fff');gradient.addColorStop(.75,'#e9eeec');gradient.addColorStop(1,'#b0bab4');
  cap.g.fillStyle=gradient;cap.g.beginPath();cap.g.arc(12,12,11,0,Math.PI*2);cap.g.fill();
  cap.g.lineWidth=1.5;cap.g.strokeStyle='#8e998f';cap.g.stroke();
  const sprite=raster('单瓶模板（隐藏）',cap.c,865,273,true);sprite.visible=false;
  const groupId='packaging-bottles-20';
  const bottles:PictureLayer[]=[];
  for(let row=0;row<4;row++) for(let col=0;col<5;col++) bottles.push({
    ...sprite, id:makeId(), name:'瓶 '+(row+1)+'排-'+(col+1)+'列',
    x:865+col*48, y:273+row*33, visible:true, locked:false, quantityGroupId:groupId,
  });
  const edge=canvas(390,28);
  edge.g.fillStyle='#b9834f';edge.g.fillRect(0,0,390,28);
  edge.g.fillStyle='#5c3b23';edge.g.font='bold 15px sans-serif';
  edge.g.fillText('出口纸箱 500ml × 20瓶',115,20);
  return {
    version:1,title:'化工包装图集｜20瓶结构示意',width:2048,height:1070,
    layers:[raster('箱体前沿',edge.c,826,424),...bottles,...cards,raster('背景和标题',bg.c,0,0,true),sprite],
    quantity:{groupId,sampleId:sprite.id,rows:4,columns:5,originX:865,originY:273,
      itemWidth:25,itemHeight:25,gapX:23,gapY:8,rowShiftX:0,columnShiftY:0,rowScale:1},
  };
}
