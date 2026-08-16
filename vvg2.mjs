import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
const cdp = await page.createCDPSession();
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "framer.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,1200));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Video/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1500));
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]').closest('div.relative'); window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
await new Promise(r=>setTimeout(r,2500));
// slow scroll: are visible videos showing frames?
let minPct=100, maxConcurrent=0;
for(let i=0;i<20;i++){
  await page.evaluate(`window.scrollBy(0,110)`); await new Promise(r=>setTimeout(r,200));
  const s = await page.evaluate(`(()=>{const vh=innerHeight;
    const vids=[...document.querySelectorAll('[data-tile] video')];
    if(vids.length>${0}) {}
    const visv=vids.filter(v=>{const r=v.getBoundingClientRect(); return r.bottom>140 && r.top<vh;});
    return {concurrent:vids.length, visLoaded: visv.length? Math.round(visv.filter(v=>v.readyState>=2).length/visv.length*100):100};})()`);
  if(s.visLoaded<minPct) minPct=s.visLoaded;
  if(s.concurrent>maxConcurrent) maxConcurrent=s.concurrent;
}
console.log("slow scroll — worst % visible videos with frame:", minPct+"%", "| max concurrent <video>:", maxConcurrent);
// fast scroll frame pacing
await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
const gaps = await page.evaluate(`new Promise(res=>{const out=[];let last=performance.now();let n=0;
  function f(now){out.push(now-last);last=now;window.scrollBy(0,110);
    if(++n<120) requestAnimationFrame(f); else res(out.slice(3));} requestAnimationFrame(f);})`);
const q=[...gaps].sort((a,b)=>a-b);
console.log(`fast scroll @4x — median ${q[Math.floor(q.length/2)].toFixed(1)}ms  p90 ${q[Math.floor(q.length*0.9)].toFixed(1)}ms  >50ms ${gaps.filter(g=>g>50).length}`);
await b.close();
