/* UI-only browser persistence: IndexedDB primary, localStorage fallback.
 * Autosave status is only "saved" after transaction completion. */
(function(root){
'use strict';const K=root.KTXH=root.KTXH||{};
const DATABASE='ktxh_offline_studio_v1',STORE='workspace';
function connect(){
 return new Promise((resolve,reject)=>{
  if(!root.indexedDB)return reject(Error('IndexedDB không khả dụng'));
  const req=indexedDB.open(DATABASE,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
  req.onerror=()=>reject(req.error||Error('Không thể mở IndexedDB'));
  req.onsuccess=()=>resolve(req.result);
 });
}
async function read(){
 const db=await connect();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get('current');
  req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
async function write(value){
 const db=await connect();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(value,'current');tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
function fallbackRead(){try{return JSON.parse(localStorage.getItem('ktxh_offline_ph1_workspace_v1')||'null');}catch{return null;}}
function fallbackWrite(value){localStorage.setItem('ktxh_offline_ph1_workspace_v1',JSON.stringify(value));}
Object.assign(K,{StudioStorage:{read,write,fallbackRead,fallbackWrite}});
})(typeof globalThis!=='undefined'?globalThis:this);
