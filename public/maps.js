import {land} from './world-land.js';

export function worldMap({label,points=[],selected=-1,onPick}){
  const figure=document.createElement('div');
  figure.className='world-map';
  const canvas=document.createElement('canvas');
  canvas.width=720;
  canvas.height=360;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',label);
  const context=canvas.getContext('2d');
  const project=(latitude,longitude)=>[(longitude+180)*2,(90-latitude)*2];
  if(context){
    context.fillStyle='#edf2f3';
    context.fillRect(0,0,720,360);
    context.fillStyle='#d4ddca';
    for(const ring of land){
      context.beginPath();
      ring.forEach(([longitude,latitude],index)=>{
        const [x,y]=project(latitude,longitude);
        if(index===0)context.moveTo(x,y);else context.lineTo(x,y);
      });
      context.closePath();
      context.fill();
    }
    points.forEach(({latitude,longitude},index)=>{
      const [x,y]=project(latitude,longitude);
      context.beginPath();
      context.arc(x,y,index===selected?9:5,0,Math.PI*2);
      context.fillStyle=index===selected?'#34573b':'#697e64';
      context.fill();
      context.strokeStyle='#fff';
      context.stroke();
    });
  }
  if(onPick){
    canvas.onclick=event=>{
      const bounds=canvas.getBoundingClientRect();
      const longitude=(event.clientX-bounds.left)/bounds.width*360-180;
      const latitude=90-(event.clientY-bounds.top)/bounds.height*180;
      onPick(latitude,longitude);
    };
  }
  figure.append(canvas);
  return figure;
}

// Crisp SVG coastlines in equirectangular coordinates (x = longitude + 180, y = 90 - latitude).
let landPath;
export function worldPath(){
  landPath??=land.map(ring=>'M'+ring.map(([lon,lat])=>`${(lon+180).toFixed(2)} ${(90-lat).toFixed(2)}`).join('L')+'Z').join('');
  return landPath;
}

// A clickable world map for choosing a place; returns the chosen latitude and longitude.
export function pickerMap({label,point,onPick}){
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 8 360 150');
  svg.setAttribute('class','picker-map');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label',label);
  const sea=document.createElementNS(NS,'rect');
  for(const [k,v] of Object.entries({x:0,y:0,width:360,height:180,class:'dg-sea'}))sea.setAttribute(k,v);
  const ground=document.createElementNS(NS,'path');
  ground.setAttribute('d',worldPath());ground.setAttribute('class','dg-land');
  svg.append(sea,ground);
  if(point){
    const dot=document.createElementNS(NS,'circle');
    for(const [k,v] of Object.entries({cx:point.longitude+180,cy:90-point.latitude,r:4,class:'picker-map-dot'}))dot.setAttribute(k,v);
    svg.append(dot);
  }
  svg.addEventListener('click',event=>{
    const box=svg.getBoundingClientRect();
    const longitude=(event.clientX-box.left)/box.width*360-180;
    const latitude=90-(8+(event.clientY-box.top)/box.height*150);
    onPick(latitude,longitude);
  });
  return svg;
}
