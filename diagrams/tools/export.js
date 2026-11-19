// usage: node export.js <svg> <outdir> <scale>
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
(async()=>{
  const [svgPath,out,scale]=process.argv.slice(2); const sc=+scale;
  const svg=fs.readFileSync(svgPath,'utf8');
  const [,W,H]=svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const names=[...svg.matchAll(/class="layer" data-name="([^"]+)"/g)].map(m=>m[1]);
  fs.mkdirSync(out,{recursive:true});
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:sc});
  const shoot=async(extraCss,file)=>{
    const doc=svg.replace('</style>',extraCss+'</style>');
    await p.setContent(`<html><body style="margin:0;background:transparent">${doc}</body></html>`);
    await p.screenshot({path:file,omitBackground:true,clip:{x:0,y:0,width:W,height:H}});
  };
  await shoot('', path.join(out,'_full.png'));
  for (const [i,n] of names.entries()){
    await shoot(`.layer{display:none}.layer[data-name="${n}"]{display:inline}`, path.join(out,`${String(i).padStart(2,'0')}.png`));
  }
  fs.writeFileSync(path.join(out,'layers.json'),JSON.stringify(names));
  await b.close();
})();
