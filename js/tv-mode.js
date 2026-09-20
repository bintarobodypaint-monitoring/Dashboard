
(function(){
  const KEY='monitoring_tv_mode';
  function applyTVMode(on){
    document.body.classList.toggle('tv-mode-active',!!on);
    const b=document.getElementById('tvModeButton');
    if(b)b.textContent=on?'📺 TV ON':'📺 TV MODE';
  }
  window.toggleTVMode=function(){
    const on=!document.body.classList.contains('tv-mode-active');
    applyTVMode(on);
    try{localStorage.setItem(KEY,on?'1':'0')}catch(e){}
    if(on && document.documentElement.requestFullscreen)
      document.documentElement.requestFullscreen().catch(()=>{});
    else if(!on && document.fullscreenElement && document.exitFullscreen)
      document.exitFullscreen().catch(()=>{});
  };
  function detectTV(){
    const large=Math.max(innerWidth,innerHeight)>=1400 &&
      matchMedia('(orientation: landscape)').matches;
    let saved=null;
    try{saved=localStorage.getItem(KEY)}catch(e){}
    applyTVMode(saved==='1'||large);
  }
  addEventListener('resize',detectTV);
  addEventListener('orientationchange',detectTV);
  detectTV();
})();
