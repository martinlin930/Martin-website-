export const UPDATE_KEY='martin-system-update';
export function readUpdate(storage,path,now=Date.now()){
 try{const data=JSON.parse(storage.getItem(UPDATE_KEY)||'null');return data&&data.path===path&&now-data.savedAt<600000?data:null;}catch{return null;}
}
export function draftFields(document){return [...document.querySelectorAll('input[id],textarea[id],select[id]')].filter(el=>!['hidden','password','file','submit','button'].includes(el.type)).map(el=>({id:el.id,value:el.value,checked:el.checked}));}
export function restoreFields(document,fields=[]){for(const field of fields){const el=document.getElementById(field.id);if(el){el.value=field.value;if(['checkbox','radio'].includes(el.type))el.checked=field.checked;}}}
export function createUpdater({version,storage,document,fetchVersion,prepare,reload,now=Date.now,curtain,ready}){
 let checking=false,updating=false,lastAttempt=0;
 async function check(){
  if(checking||updating||document.hidden||now()-lastAttempt<5000)return;
  lastAttempt=now();checking=true;
  try{
   const next=await fetchVersion();if(!next||next===version)return;
   // Do not lose an in-progress file upload or password entry.
   if([...document.querySelectorAll('input[type=file],input[type=password]')].some(el=>el.type==='file'?el.files?.length:el.value))return;
   updating=true;curtain(true);
   let saved;try{
    saved=await prepare();
    storage.setItem(UPDATE_KEY,JSON.stringify({path:location.pathname,version:next,savedAt:now(),saved,fields:draftFields(document)}));
    reload();
   }catch(error){updating=false;curtain(false);await ready?.(error,saved);}
  }catch{}finally{checking=false;}
 }
 return {check};
}
if(typeof window!=='undefined'){
 const curtain=enabled=>document.documentElement.classList.toggle('system-updating',enabled);
 const previous=readUpdate(sessionStorage,location.pathname);
 const finish=()=>{sessionStorage.removeItem(UPDATE_KEY);curtain(false);};
 if(previous){restoreFields(document,previous.fields);if((!previous.saved?.resume&&!previous.saved?.waitForReady)||window.systemUpdateRestored)finish();}
 else curtain(false);
 window.addEventListener('system-update-ready',finish);
 let pendingMutations=0;
 const originalFetch=window.fetch.bind(window);
 window.fetch=(input,options)=>{const method=(options?.method||input?.method||'GET').toUpperCase();if(!['POST','PUT','PATCH','DELETE'].includes(method))return originalFetch(input,options);pendingMutations++;return originalFetch(input,options).finally(()=>pendingMutations--);};
 const updater=createUpdater({version:window.siteVersion,storage:sessionStorage,document,curtain,fetchVersion:async()=>{const r=await fetch('/api/version',{cache:'no-store'});if(!r.ok)throw Error('Update server unavailable');return (await r.json()).version;},prepare:async()=>{const deadline=Date.now()+8000;while(pendingMutations){if(Date.now()>deadline)throw Error('Waiting for a save');await new Promise(resolve=>setTimeout(resolve,50));}return window.prepareSystemUpdate?window.prepareSystemUpdate():{};},reload:()=>location.reload(),ready:(error,saved)=>window.abortSystemUpdate?.(saved)});
 const interval=setInterval(updater.check,30000);
 window.addEventListener('site-version',event=>{if(event.detail&&event.detail!==window.siteVersion)updater.check();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)updater.check();});
 window.addEventListener('pagehide',()=>clearInterval(interval));
 setTimeout(updater.check,5000);
}
