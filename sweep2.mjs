const SITES = [
  // small studios, portfolios and indie sites across different builders
  "https://sondaven.com/en", "https://motionsites.ai/", "https://saddine.com/",
  "https://www.awwwards.com/", "https://tobiasahlin.com/", "https://paco.me/",
  "https://rauno.me/", "https://leerob.com/", "https://brittanychiang.com/",
  "https://www.joshwcomeau.com/", "https://bruno-simon.com/", "https://maxibestof.one/",
  "https://www.pentagram.com/", "https://basicagency.com/", "https://www.instrument.com/",
  "https://readymag.com/", "https://cargo.site/", "https://www.squarespace.com/",
  "https://webflow.com/", "https://www.notion.com/", "https://ghost.org/",
  "https://bearblog.dev/", "https://neal.fun/", "https://www.are.na/",
];
const CONC = 3;
const out = [];
const queue = [...SITES];
async function one(url){
  const t0 = Date.now();
  try{
    const res = await fetch("https://pagehaul.vercel.app/api/scan",{
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({url, deep:true}), signal: AbortSignal.timeout(200000)});
    const text = await res.text();
    let d=null; try{ d=JSON.parse(text);}catch{}
    const s=Math.round((Date.now()-t0)/1000);
    if(!d) return {url, s, status:"NON-JSON"};
    if(d.error) return {url, s, status:"ERROR", detail:d.error.slice(0,60)};
    const shown=d.assets.filter(a=>a.isLargest!==false);
    const pics=shown.filter(a=>!a.noise&&/image|svg|video/.test(a.kind));
    return {url, s, status:"ok", assets:shown.length, pics:pics.length,
            note:(d.notes&&d.notes[0]||"").slice(0,34)};
  }catch(e){ return {url, s:Math.round((Date.now()-t0)/1000), status:"THREW", detail:String(e).slice(0,50)}; }
}
await Promise.all(Array.from({length:CONC}, async()=>{
  while(queue.length){ const u=queue.shift(); const r=await one(u); out.push(r);
    const host=new URL(u).hostname.replace(/^www\./,"");
    console.log(host.padEnd(24),
      r.status==="ok" ? `${String(r.s).padStart(3)}s  ${String(r.assets).padStart(4)} assets  ${String(r.pics).padStart(4)} pics ${r.note?"| "+r.note:""}`
                      : `${String(r.s).padStart(3)}s  ${r.status} ${r.detail||""}`);
  }
}));
const ok=out.filter(r=>r.status==="ok");
const empty=ok.filter(r=>r.pics===0);
console.log(`\n${ok.length}/${out.length} returned a result · ${out.length-ok.length} failed · ${empty.length} returned zero pictures`);
if(out.length-ok.length) console.log("failures:", out.filter(r=>r.status!=="ok").map(r=>new URL(r.url).hostname).join(", "));
if(empty.length) console.log("empty:", empty.map(r=>new URL(r.url).hostname).join(", "));
