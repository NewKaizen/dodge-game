// Ícones nativos: corpo inteiro e um detalhe que identifique o lutador a 20–44 px.
// npm: node scripts/gerar-icones.mjs
import sharp from 'sharp'
import { SPRITES } from '../src/game/arte/sprites.js'
import { PERSONAGENS } from '../src/game/data/personagens.js'
import { IDS_ICONES } from '../src/game/arte/icones.js'
const joias = {
  kris:   [2,13,['.....h','....hh','...hhv','..hhv.','.hhv..','vhv...','.g....','k.g...']],
  susie:  [18,6,['..vv...','.vhhv..','..hhhv.','...hhhv','..gvhhv','.gg.vv.','gg.....','g......']],
  ralsei: [19,7,['...h...','.v.h.v.','..vhv..','hhhhhvh','..vhv..','.v.h.v.','...h...']],
  noelle: [18,8,['..v.h.v','...vhv.','....h..','.hhhhhh','...vhv.','..v.h.v']],
  berdly: [1,4,['..h....','..hv...','.hhhv..','vhhvhv.','.hhv...','..g....','..g....','..g....','..g....','..g....','..g....','..g....','..g....']],
  dess:   [17,5,['.....gg','....ghg','...ghg.','..ghg..','.ghg...','ggg....','gg.....','g......']],
  asriel: [19,10,['.....h','....hh','...hhv','..hhv.','.hhv..','vhv...','.g....','g.g...']]
}
const tons={kris:['#ffecfa','#ff66ba'],susie:['#e5dcff','#a374db'],ralsei:['#d4ffee','#51f5a6'],noelle:['#f1ffff','#81deff'],berdly:['#d8ffff','#5acccb'],dess:['#eed391','#c0834e'],asriel:['#fff5bd','#ffb947']}
for (const id of IDS_ICONES) {
  const {mapa,paleta}=SPRITES[id], lado=28
  const pixels=new Map(), put=(x,y,c)=>pixels.set(y*lado+x,c)
  const w=Math.max(...mapa.map(r=>r.length)), h=mapa.length
  const scale=Math.min(1,24/w,24/h), dw=Math.round(w*scale), dh=Math.round(h*scale)
  const dx=Math.floor((lado-dw)/2), dy=Math.floor((lado-dh)/2)
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){const c=paleta[mapa[Math.floor(y*h/dh)]?.[Math.floor(x*w/dw)]];if(c)put(dx+x,dy+y,c)}
  if(PERSONAGENS[id]){
    const [x0,y0,rows]=joias[id], [light,shade]=tons[id]
    rows.forEach((row,y)=>[...row].forEach((k,x)=>{const c={h:light,v:shade,g:'#d7ad69',k:'#614860'}[k];if(c)put(x0+x,y0+y,c)}))
  }
  const data=Buffer.alloc(lado*lado*4)
  const draw=(i,c)=>{if(i<0||i>=lado*lado)return;const n=parseInt(c.slice(1),16);data.set([n>>16,(n>>8)&255,n&255,255],i*4)}
  for(const p of pixels.keys())for(const d of [-1,1,-lado,lado])if(!pixels.has(p+d))draw(p+d,'#201d32')
  for(const [p,c] of pixels)draw(p,c)
  await sharp(data,{raw:{width:lado,height:lado,channels:4}}).png().toFile(new URL('../public/assets/sprites/icones/'+id+'.png',import.meta.url).pathname)
}
