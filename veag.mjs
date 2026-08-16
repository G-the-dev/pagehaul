import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "unsplash.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,3000));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Images/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1500));
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]').closest('div.relative'); window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
await new Promise(r=>setTimeout(r,6000)); // let initial band load
// SLOW continuous scroll; sample how many VISIBLE tiles have a loaded image mid-scroll
let minLoadedPct=100;
for (let i=0;i<30;i++){
  await page.evaluate(`window.scrollBy(0,120)`);
  await new Promise(r=>setTimeout(r,180));
  const pct = await page.evaluate(`(()=>{
    const vh=innerHeight;
    const imgs=[...document.querySelectorAll('[data-tile] img')].filter(im=>{const r=im.getBoundingClientRect(); return r.bottom>140 && r.top<vh;});
    if(!imgs.length) return 100;
    return Math.round(imgs.filter(im=>im.complete&&im.naturalWidth>0).length/imgs.length*100);
  })()`);
  if(pct<minLoadedPct) minLoadedPct=pct;
}
console.log("worst % of visible image tiles loaded DURING slow scroll:", minLoadedPct+"%");
await b.close();
