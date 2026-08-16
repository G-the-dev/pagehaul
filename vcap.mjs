import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "framer.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,1200));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Video/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1000));
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]').closest('div.relative'); window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
// let videos render, then capture runs on idle
await new Promise(r=>setTimeout(r,8000));
// scroll away and back; count how many tiles now render a cached <img> vs live <video>
await page.evaluate(`window.scrollBy(0, 3000)`); await new Promise(r=>setTimeout(r,3000));
await page.evaluate(`window.scrollTo(0, document.querySelector('[data-tile]').closest('div.relative').getBoundingClientRect().top + window.scrollY - 40)`);
await new Promise(r=>setTimeout(r,2500));
const st = await page.evaluate(`(()=>{
  const tiles=[...document.querySelectorAll('[data-tile]')];
  const vids=tiles.filter(t=>t.querySelector('video')).length;
  // cached posters render as <img> inside a video tile — detect by the play badge sibling
  const imgFrames=[...document.querySelectorAll('[data-tile]')].filter(t=>t.querySelector('img[src^="data:"]')).length;
  return { tiles:tiles.length, liveVideo:vids, cachedImg:imgFrames };
})()`);
console.log("on scroll-back:", JSON.stringify(st));
await b.close();
