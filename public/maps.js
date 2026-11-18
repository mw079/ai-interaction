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
