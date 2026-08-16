import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "stripe.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,3000));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Images/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1000));
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]').closest('div.relative'); window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
await new Promise(r=>setTimeout(r,5000));
const painted = await page.evaluate(`(()=>{const imgs=[...document.querySelectorAll('[data-tile] img')]; return {total:imgs.length, loaded:imgs.filter(i=>i.complete&&i.naturalWidth>0).length, optimized:imgs.filter(i=>i.currentSrc.includes('/_next/image')).length};})()`);
console.log("first view:", JSON.stringify(painted));
// now measure scroll-back network
let net=0, fromCache=0;
page.on("response", async r => { if(r.url().includes("/_next/image")){ net++; try{ const t=r.timing(); }catch{} if(r.fromCache&&r.fromCache()) fromCache++; }});
await page.evaluate(`window.scrollBy(0,4000)`); await new Promise(r=>setTimeout(r,2500));
net=0;
await page.evaluate(`window.scrollTo(0, document.querySelector('[data-tile]').closest('div.relative').getBoundingClientRect().top + window.scrollY - 40)`);
await new Promise(r=>setTimeout(r,4000));
console.log("scroll-back optimizer responses:", net, "(from browser cache count:", fromCache, ")");
// also check the raw fetch: were any served 200 from network vs disk?
await b.close();
