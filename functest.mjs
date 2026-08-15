import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, args:["--no-sandbox"] });
const page = await b.newPage();
const errs=[];
page.on("pageerror", e=>errs.push(String(e).slice(0,90)));
page.on("console", m=>{ if(m.type()==="error") errs.push(m.text().slice(0,90)); });
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "stripe.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 220000 });
await new Promise(r=>setTimeout(r,1500));
console.log("scan ok, tiles:", await page.evaluate(`document.querySelectorAll('[data-tile]').length`));
// lazy dialog
await page.evaluate(`document.querySelector('button[aria-label^="Preview"]').click()`);
await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
console.log("preview dialog (lazy) opened:", true);
await page.keyboard.press("ArrowRight"); await new Promise(r=>setTimeout(r,300));
console.log("arrow nav works:", await page.evaluate(`/\\d+ of \\d+/.test(document.querySelector('[role="dialog"]').innerText)`));
await page.keyboard.press("Escape"); await new Promise(r=>setTimeout(r,400));
// lazy picker
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/Choose/.test(b.textContent||'')).click();})()`);
await page.waitForFunction(`/Choose what to download/.test(document.body.innerText)`, { timeout: 15000 });
console.log("picker (lazy) opened:", true);
await page.keyboard.press("Escape"); await new Promise(r=>setTimeout(r,400));
// lazy design panel
await page.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>/Design/.test(t.textContent)); t&&t.click();})()`);
await new Promise(r=>setTimeout(r,1500));
console.log("design panel (lazy) rendered:", await page.evaluate(`/Palette|colours and type/.test(document.body.innerText)`));
console.log("page errors:", errs.length ? errs.slice(0,4) : "none");
await b.close();
