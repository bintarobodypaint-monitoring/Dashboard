
(function(){
  let liveAudioUnlocked=false;
  function unlockLiveAudio(){
    if(liveAudioUnlocked)return;
    liveAudioUnlocked=true;
    try{
      const A=window.AudioContext||window.webkitAudioContext;
      if(!A)return;
      const c=new A();
      if(c.state==='suspended')c.resume();
      const o=c.createOscillator(),g=c.createGain();
      g.gain.value=0.00001;o.connect(g);g.connect(c.destination);
      o.start();o.stop(c.currentTime+0.02);
      setTimeout(function(){try{c.close()}catch(e){}},100);
    }catch(e){}
  }
  ['click','touchstart','keydown'].forEach(function(evt){
    document.addEventListener(evt,unlockLiveAudio,{once:false,passive:true});
  });
})();
