export function setupWorkspace(){
 const panel=document.querySelector('.intent-panel'),paper=document.querySelector('.paper');
 const stage=document.createElement('div');stage.className='atlas-stage';paper.before(stage);stage.append(paper);
 let hoverTimer;
 const composer=document.querySelector('.composer');new ResizeObserver(()=>document.body.style.setProperty('--composer-height',composer.offsetHeight+'px')).observe(composer);
 // The page area and the dock share the window (see the split layout in page.css): focusing the
 // composer only toggles composer-active; nothing is measured or scaled here.
 function focus(on){clearTimeout(hoverTimer);document.body.classList.toggle('composer-active',on);}
 const isComposerControl=element=>panel.contains(element)||element?.closest('.intent-details,#intent-popover');
 panel.addEventListener('focusin',()=>focus(true));panel.addEventListener('pointerdown',()=>focus(true));panel.addEventListener('input',()=>focus(true));panel.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter')return;focus(true);});   // ⌘/Ctrl+Enter sends: reading, not writing
 document.addEventListener('focusin',event=>{if(event.target.closest('.intent-details,#intent-popover'))focus(true);});
 paper.addEventListener('pointerenter',event=>{
  if(event.pointerType!=='mouse')return;
  // Closing a picker can put the pointer over the slide as focus returns to the draft.
  hoverTimer=setTimeout(()=>{if(!isComposerControl(document.activeElement))focus(false);},140);
 });
 paper.addEventListener('pointerleave',()=>clearTimeout(hoverTimer));paper.addEventListener('pointerdown',()=>focus(false));paper.addEventListener('focusin',()=>focus(false));
 return {reading:()=>focus(false)};
}
