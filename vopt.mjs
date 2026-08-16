import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
// count requests: how many go to origins vs our optimizer
let optReqs=0, originImgReqs=0;
page.on("request", r => {
  const u=r.url();
  if (u.includes("/_next/image")) optReqs++;
  else if (r.resourceType()==="image" && /^https?:\/\//.test(u) && !u.includes("localhost")) originImgReqs++;
});
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "recent.design");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,3000));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Images/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1000));
optReqs=0; originImgReqs=0;
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]')?.closest('div.relative'); if(g) window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
await new Promise(r=>setTimeout(r,5000));
console.log("first view — optimizer reqs:", optReqs, "| direct-origin img reqs:", originImgReqs);
const painted = await page.evaluate(`(()=>{const imgs=[...document.querySelectorAll('[data-tile] img')]; return {total:imgs.length, loaded:imgs.filter(i=>i.complete&&i.naturalWidth>0).length};})()`);
console.log("image tiles:", JSON.stringify(painted));
// scroll away and back — should NOT re-request (cached)
await page.evaluate(`window.scrollBy(0,3000)`); await new Promise(r=>setTimeout(r,2500));
optReqs=0;
await page.evaluate(`window.scrollTo(0, document.querySelector('[data-tile]').closest('div.relative').getBoundingClientRect().top + window.scrollY - 40)`);
await new Promise(r=>setTimeout(r,3500));
console.log("scroll-BACK — optimizer reqs (should be ~0, cached):", optReqs);
await b.close();
