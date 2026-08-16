import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "framer.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,1500));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Video/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1000));
// count video network requests as we scroll away and back
let videoReqs = 0;
page.on("request", r => { if (r.resourceType()==="media") videoReqs++; });
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]').closest('div.relative'); window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
await new Promise(r=>setTimeout(r,4000));
const firstPass = videoReqs;
console.log("video requests on first view:", firstPass);
// scroll far down then back up to the same tiles
await page.evaluate(`window.scrollBy(0, 2000)`); await new Promise(r=>setTimeout(r,2500));
videoReqs = 0;
await page.evaluate(`window.scrollTo(0, document.querySelector('[data-tile]').closest('div.relative').getBoundingClientRect().top + window.scrollY - 40)`);
await new Promise(r=>setTimeout(r,4000));
console.log("video requests on scroll-BACK to same tiles:", videoReqs, videoReqs>0?"(re-fetching)":"(cached, no refetch)");
// how long to paint a frame on remount?
const painted = await page.evaluate(`(()=>{const v=[...document.querySelectorAll('[data-tile] video')]; return {total:v.length, ready:v.filter(x=>x.readyState>=2).length};})()`);
console.log("video tiles now mounted:", JSON.stringify(painted));
await b.close();
