(function(){
'use strict';
const KEY='dms_authenticated_v5',TTL=12*60*60*1000;
const USERS={
  superadmin:{password:'BintaroBP@12345',role:'admin'},
  saadm:{password:'jpcb@202601',role:'saadm'},
  gardaoto:{password:'aab@2026',role:'garda'}
};
function user(){
  try{
    const d=JSON.parse(localStorage.getItem(KEY)||'null');
    if(d&&Object.prototype.hasOwnProperty.call(USERS,d.user)&&Number.isFinite(+d.at)&&Date.now()>=+d.at&&Date.now()-d.at<TTL)return d.user;
    localStorage.removeItem(KEY);
  }catch(_){}
  return '';
}
function home(){
  const p=location.pathname;
  return (p.includes('/pages/')?p.split('/pages/')[0]:p.slice(0,p.lastIndexOf('/')))+'/index.html';
}
function canAccess(path){
  const u=user();
  if(!u)return false;
  const role=USERS[u].role;
  if(role==='admin')return true;
  const file=String(path||'').split('?')[0].split('#')[0].split('/').pop();
  if(file==='index.html'||file==='')return true;
  return role==='garda'?file==='garda-oto.html':file==='jpcb.html'||file==='database.html';
}
window.DMSAuth={
  getUser:user,isLoggedIn:()=>!!user(),isGarda:()=>user()==='gardaoto',canAccess,
  login(name,pass){
    name=String(name||'').trim().toLowerCase();
    if(!Object.prototype.hasOwnProperty.call(USERS,name)||USERS[name].password!==String(pass||''))return false;
    try{localStorage.setItem(KEY,JSON.stringify({user:name,at:Date.now()}));}catch(_){return false;}
    return true;
  },
  logout(){try{[KEY,'dms_authenticated_v4','dms_authenticated_v3'].forEach(k=>localStorage.removeItem(k));}catch(_){}},
  requireLogin(){
    if(!user()){location.replace(home()+'?login=1');return false;}
    if(!canAccess(location.pathname)){location.replace(home());return false;}
    return true;
  }
};
})();
