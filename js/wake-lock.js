
(function(){
  let wakeLock = null;
  const indicator = document.getElementById('wakeLockIndicator');
  const text = document.getElementById('wakeLockText');

  function setWakeStatus(on){
    if(!indicator)return;
    indicator.classList.toggle('off', !on);
    if(text) text.textContent = on ? 'LAYAR AKTIF' : 'WAKE LOCK OFF';
  }

  async function requestWakeLock(){
    if(!('wakeLock' in navigator)){
      setWakeStatus(false);
      if(text) text.textContent = 'WAKE LOCK TIDAK DIDUKUNG';
      return;
    }

    if(document.visibilityState !== 'visible') return;

    try{
      if(wakeLock) await wakeLock.release().catch(()=>{});
      wakeLock = await navigator.wakeLock.request('screen');
      setWakeStatus(true);

      wakeLock.addEventListener('release', function(){
        wakeLock = null;
        setWakeStatus(false);
        // Browser dapat melepas Wake Lock ketika kondisi perangkat berubah.
        // Kita akan meminta ulang saat halaman aktif kembali.
      });
    }catch(err){
      console.warn('Wake Lock:', err);
      setWakeStatus(false);
    }
  }

  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible'){
      requestWakeLock();
    }else{
      setWakeStatus(false);
    }
  });

  window.addEventListener('pageshow', requestWakeLock);
  window.addEventListener('focus', requestWakeLock);

  // Coba aktifkan segera.
  requestWakeLock();

  // Safety re-check berkala.
  setInterval(function(){
    if(document.visibilityState === 'visible' && !wakeLock){
      requestWakeLock();
    }
  }, 30000);
})();
