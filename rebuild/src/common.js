/* R20eb 4: deliberately small shared, page-world primitives. */
'use strict';
const R4 = Object.freeze({
  protocol:'r20eb:v4',
  editor:'https://app.roll20.net',
  sheet:'https://advanced-sheets.production.roll20preflight.net',
  id(value){const s=String(value??'').trim();return /^[A-Za-z0-9_-]{5,110}$/.test(s)?s:'';},
  text(value,max=160){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);},
  same(a,b){return this.text(a,160).toLocaleLowerCase()===this.text(b,160).toLocaleLowerCase();},
  model(model,key){try{return model?.get?.(key)??model?.attributes?.[key]??null;}catch{return null;}},
  authorized(model,player){
    if(!model||!player)return false;
    const raw=this.model(model,'controlledby')??this.model(model,'controlled_by')??'';
    const ids=String(raw).split(',').map(x=>x.trim());
    return ids.includes('all')||ids.includes(String(player));
  },
  merge(base,part){
    const next={...base,...part,stats:{...base?.stats,...part?.stats},
      categories:{...base?.categories}};
    for(const key of ['attacks','spells','features','inventory','skills','saves','resources','misc']){
      if(Array.isArray(part?.categories?.[key])&&part.categories[key].length)
        next.categories[key]=part.categories[key];
    }
    return next;
  },
  hasData(snapshot){
    return !!snapshot&&(Object.keys(snapshot.stats||{}).length>0||
      Object.values(snapshot.categories||{}).some(v=>Array.isArray(v)&&v.length>0));
  },
  progress(done,total,partial=0,partialTotal=1,errors=0){
    if(!total)return 0;
    const units=Math.max(0,done)+Math.max(0,Math.min(.9,partial/Math.max(1,partialTotal)*.9));
    return Math.min(errors?99:100,Math.floor(100*units/total));
  }
});
