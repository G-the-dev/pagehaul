import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 2 });
await page.goto("https://pagehaul.vercel.app", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "stripe.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,3500));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Images/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,2000));
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]').closest('div.relative'); window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
await new Promise(r=>setTimeout(r,5000));
// slow scroll, sample blank tiles
let minPct=100;
for(let i=0;i<24;i++){
  await page.evaluate(`window.scrollBy(0,120)`); await new Promise(r=>setTimeout(r,190));
  const pct = await page.evaluate(`(()=>{const vh=innerHeight;
    const imgs=[...document.querySelectorAll('[data-tile] img')].filter(im=>{const r=im.getBoundingClientRect(); return r.bottom>140&&r.top<vh;});
    return imgs.length? Math.round(imgs.filter(im=>im.complete&&im.naturalWidth>0).length/imgs.length*100):100;})()`);
  if(pct<minPct)minPct=pct;
}
console.log("PROD slow-scroll: worst % visible image tiles loaded:", minPct+"%");
await page.screenshot({ path:"/tmp/prodfinal.jpg", type:"jpeg", quality:80 });
await b.close();
