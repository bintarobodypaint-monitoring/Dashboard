
function playSearchCling(){
try{
const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
const c=new A(),n=c.currentTime;
[[880,1320,0,.45],[1175,1760,.08,.52]].forEach(x=>{
const o=c.createOscillator(),g=c.createGain();o.type='sine';
o.frequency.setValueAtTime(x[0],n+x[2]);o.frequency.exponentialRampToValueAtTime(x[1],n+x[2]+.16);
g.gain.setValueAtTime(.0001,n+x[2]);g.gain.exponentialRampToValueAtTime(.14,n+x[2]+.02);
g.gain.exponentialRampToValueAtTime(.0001,n+x[3]);o.connect(g);g.connect(c.destination);
o.start(n+x[2]);o.stop(n+x[3]+.02);
});setTimeout(()=>{try{c.close()}catch(e){}},700);
}catch(e){}
}
function showSearchFound(unit){
const ov=document.getElementById('searchFoundOverlay');if(!ov)return;
const plate=unit?.nopol||unit?.NOPOL||unit?.['NO POLISI']||'-';
const group=unit?.group||unit?.GROUP||'-',type=unit?.type||unit?.TYPE||'-';
const progress=unit?.progress||unit?.PROGRESS||'-',sa=unit?.sa||unit?.SA||'-';
document.getElementById('searchFoundPlate').textContent=String(plate).toUpperCase();
document.getElementById('searchFoundInfo').innerHTML=
'<strong>'+escSF(group)+'</strong> • <strong>'+escSF(type)+'</strong><br>Progress: <strong>'+escSF(progress)+'</strong><br>SA: <strong>'+escSF(sa)+'</strong>';
ov.classList.add('show');playSearchCling();
clearTimeout(window.searchFoundTimer);
window.searchFoundTimer=setTimeout(()=>{
ov.classList.remove('show');
try{
if(typeof openJpcbUnitDetail==='function')openJpcbUnitDetail(unit);
else if(typeof openUnitDetail==='function')openUnitDetail(unit);
else if(typeof showUnitDetail==='function')showUnitDetail(unit);
}catch(e){console.error(e)}
},1800);
}
function escSF(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]);}
