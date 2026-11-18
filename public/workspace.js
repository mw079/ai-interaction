export function setupWorkspace(){
 const panel=document.querySelector('.intent-panel'),paper=document.querySelector('.paper');
 const stage=document.createElement('div');stage.className='atlas-stage';paper.before(stage);stage.append(paper);
 let hoverTimer;
 const composer=document.querySelector('.composer');new ResizeObserver(()=>document.body.style.setProperty('--composer-height',composer.offsetHeight+'px')).observe(composer);
 const size=()=>{if(!document.body.classList.contains('page-open'))return;stage.style.height=paper.offsetHeight*(document.body.classList.contains('composer-active')?.9:1)+'px';};
 function focus(on){clearTimeout(hoverTimer);document.body.classList.toggle('composer-active',on);size();}
 panel.addEventListener('focusin',()=>focus(true));panel.addEventListener('pointerdown',()=>focus(true));panel.addEventListener('input',()=>focus(true));panel.addEventListener('keydown',()=>focus(true));
 document.addEventListener('focusin',event=>{if(event.target.closest('.intent-details,#intent-popover'))focus(true);});
 paper.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')hoverTimer=setTimeout(()=>focus(false),140);});paper.addEventListener('pointerleave',()=>clearTimeout(hoverTimer));paper.addEventListener('pointerdown',()=>focus(false));paper.addEventListener('focusin',()=>focus(false));
 new ResizeObserver(size).observe(paper);new MutationObserver(size).observe(document.body,{attributes:true,attributeFilter:['class']});
 return {reading:()=>focus(false),writing:()=>focus(true)};
}
