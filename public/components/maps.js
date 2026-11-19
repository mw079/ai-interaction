import {land} from './world-land.js';

// Crisp SVG coastlines in equirectangular coordinates (x = longitude + 180, y = 90 - latitude).
let landPath;
export function worldPath(){
  landPath??=land.map(ring=>'M'+ring.map(([lon,lat])=>`${(lon+180).toFixed(2)} ${(90-lat).toFixed(2)}`).join('L')+'Z').join('');
  return landPath;
}

// A clickable world map for choosing a place; returns the chosen latitude and longitude.
export function areaMap({label,point,onPick}){
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 8 360 150');
  svg.setAttribute('class','control-map');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label',label);
  const sea=document.createElementNS(NS,'rect');
  for(const [k,v] of Object.entries({x:0,y:0,width:360,height:180,class:'dg-sea'}))sea.setAttribute(k,v);
  const ground=document.createElementNS(NS,'path');
  ground.setAttribute('d',worldPath());ground.setAttribute('class','dg-land');
  svg.append(sea,ground);
  if(point){
    const dot=document.createElementNS(NS,'circle');
    for(const [k,v] of Object.entries({cx:point.longitude+180,cy:90-point.latitude,r:4,class:'control-map-dot'}))dot.setAttribute(k,v);
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
