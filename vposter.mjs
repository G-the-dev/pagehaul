import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
let posterReqs=0;
page.on("request", r => { if (r.url().includes("/api/poster")) posterReqs++; });
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "framer.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,1200));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Video/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1500));
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]').closest('div.relative'); window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
// posters capture ~1/sec server-side; give them time
await new Promise(r=>setTimeout(r,15000));
const st = await page.evaluate(`(()=>{
  const tiles=[...document.querySelectorAll('[data-tile]')];
  const posterImgs=tiles.filter(t=>{const i=t.querySelector('img'); return i && i.src.includes('/api/poster') && i.complete && i.naturalWidth>0;}).length;
  const liveVideo=tiles.filter(t=>t.querySelector('video')).length;
  return { tiles:tiles.length, posterImgsLoaded:posterImgs, liveVideo };
})()`);
console.log("video tab after posters captured:", JSON.stringify(st), "| poster requests:", posterReqs);
await b.close();
