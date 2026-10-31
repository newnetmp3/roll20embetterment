/* The only module aware of Jumpgate internals. Read-only, bounded,
 * fail-closed and separate from character permissions or the DOM reader. */
const R4J=(()=>{
 let firstRender=false,checked=0,lastCheck=0,engineClass=null,build='',status='waiting for render';
 const knownModule=73210;
 try{
  const observer=new PerformanceObserver(list=>{
   if(list.getEntries().some(x=>x.name==='jumpgate-render-end')){
    firstRender=true;status='Jumpgate render observed';observer.disconnect();
   }
  });
  observer.observe({type:'mark',buffered:true});
 }catch{status='PerformanceObserver unavailable';}
 function factoryVerified(factory){
  if(typeof factory!=='function')return false;
  try{
   const source=Function.prototype.toString.call(factory);
   return source.length>=50000&&source.length<=2000000&&
    /VTTEngine:\s*\(\)\s*=>\s*[\w$]+/.test(source.slice(0,1024))&&
    /getSelection\(\)\s*\{\s*return\s+this\.tabletop\.getSelection\(\)\s*;?\s*\}/.test(source)&&
    /getSelection\(\)\s*\{[^}]{0,550}\.children[^}]{0,200}\}/.test(source)&&
    source.includes('dataWrapper.model');
  }catch{return false;}
 }
 function findFactory(require){
  const registry=require?.m;
  if(!registry||typeof registry!=='object')return null;
  if(factoryVerified(registry[knownModule]))return knownModule;
  const ids=Object.keys(registry);
  if(ids.length>16000)return null;
  let bytes=0,found=null;
  for(const id of ids){
   if(!/^(?:0|[1-9]\d{0,9})$/.test(id))continue;
   const fn=registry[id];
   if(typeof fn!=='function')continue;
   let code='';
   try{code=Function.prototype.toString.call(fn);}catch{continue;}
   bytes+=code.length;if(bytes>64000000)return null;
   if(!code.includes('VTTEngine')||!code.includes('getSelection')||
      !code.includes('dataWrapper.model'))continue;
   if(!factoryVerified(fn))continue;
   if(found!==null)return null; // Ambiguous registry is unsafe.
   found=Number(id);
  }
  return found;
 }
 function getterVerified(fn){
  if(typeof fn!=='function'||fn.length!==0)return false;
  try{
   const code=Function.prototype.toString.call(fn);
   return code.length<600&&/^getSelection\(\)\s*\{/.test(code)&&
    /\breturn\b/.test(code)&&/\.children\b/.test(code)&&
    !/(?:\+\+|--|\b(?:delete|new|await|throw|yield)\b|\.\s*(?:add|set|push|splice|remove|clear|delete)\s*\()/.test(code);
  }catch{return false;}
 }
 function bootstrap(){
  if(engineClass||checked>=3||Date.now()-lastCheck<3000)return;
  // First rendered page or an already mounted Babylon canvas. Never force
  // the lazy singleton while Roll20 is still constructing the tabletop.
  if(!firstRender&&(!document.querySelector('#babylonCanvas,canvas[data-engine^="Babylon.js"]')||
    document.readyState!=='complete'))return;
  lastCheck=Date.now();checked++;
  const chunk=window.webpackChunkvtt;
  if(!Array.isArray(chunk)||typeof chunk.push!=='function'){
   status='Webpack selection bridge not registered';return;
  }
  try{
   chunk.push([['r20eb-v4-read-'+checked],{},require=>{
    try{
     build=typeof require.h==='function'?String(require.h()).slice(0,64):'';
     const moduleId=findFactory(require);
     if(moduleId===null){status='No unique verified Jumpgate selection adapter';return;}
     const candidate=require(moduleId)?.VTTEngine;
     if(typeof candidate!=='function')throw Error('VTTEngine export changed');
     engineClass=candidate;status='Verified Jumpgate module '+moduleId;
    }catch(e){status='Selection adapter unavailable: '+String(e.message).slice(0,90);}
   }]);
  }catch{status='Jumpgate chunk callback unavailable';}
 }
 function read(){
  const direct=window.jumpgate?.tabletop;
  if(typeof direct?.getSelection==='function'){
   try{
    const values=direct.getSelection();
    if(Array.isArray(values))return {items:values.slice(0,80),status:'Direct Jumpgate getter'};
   }catch{}
  }
  bootstrap();
  if(!engineClass)return {items:[],status};
  try{
   const tabletop=engineClass.instance?.tabletop;
   if(!tabletop)return {items:[],status:'Jumpgate tabletop initializing'};
   if(!getterVerified(tabletop.getSelection))
    return {items:[],status:'Unsupported Jumpgate selection getter'};
   const values=tabletop.getSelection();
   if(!Array.isArray(values))return {items:[],status:'Unexpected Jumpgate selection shape'};
   return {items:values.slice(0,80),status:'Verified Jumpgate getter ('+(build||'unknown build')+')'};
  }catch{return {items:[],status:'Jumpgate selection read unavailable'};}
 }
 return {read,factoryVerified,getterVerified};
})();
