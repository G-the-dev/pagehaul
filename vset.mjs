import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
const cdp = await page.createCDPSession();
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "framer.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,1500));
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Video/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1000));
await page.evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';
  const g=document.querySelector('[data-tile]').closest('div.relative'); window.scrollTo(0,g.getBoundingClientRect().top+window.scrollY-40);})()`);
await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
// DURING an active fast scroll, count decoding videos + measure frames
await page.evaluate(`window.scrollTo(0,700)`); await new Promise(r=>setTimeout(r,400));
const during = await page.evaluate(`new Promise(res=>{const out=[];let last=performance.now();let n=0;let maxVids=0;
  function f(now){out.push(now-last);last=now;window.scrollBy(0,90);
    const v=document.querySelectorAll('[data-tile] video').length; if(v>maxVids)maxVids=v;
    if(++n<120) requestAnimationFrame(f); else res({gaps:out.slice(3),maxVids});} requestAnimationFrame(f);})`);
const q=[...during.gaps].sort((a,b)=>a-b);
console.log(`DURING scroll @4x — median ${q[Math.floor(q.length/2)].toFixed(1)}ms  p90 ${q[Math.floor(q.length*0.9)].toFixed(1)}ms  frames>50ms ${during.gaps.filter(g=>g>50).length}  | max <video> mounted mid-scroll: ${during.maxVids}`);
// after settling, videos should appear
await new Promise(r=>setTimeout(r,900));
const after = await page.evaluate(`document.querySelectorAll('[data-tile] video').length`);
console.log("videos decoding after scroll stops:", after);
await b.close();
