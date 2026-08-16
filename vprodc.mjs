import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, protocolTimeout:400000, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
await page.goto("https://pagehaul.vercel.app", { waitUntil:"networkidle2", timeout:60000 });
await page.type('input', "stripe.com");
await page.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/^Scan/.test((b.textContent||'').trim())).click();})()`);
await page.waitForFunction(`document.querySelectorAll('[role="tab"]').length > 2`, { timeout: 300000 });
await new Promise(r=>setTimeout(r,3500));
// open a preview, screenshot to check arrow placement
await page.evaluate(`document.querySelectorAll('button[aria-label^="Preview"]')[2].click()`);
await page.waitForSelector('[role="dialog"]',{timeout:15000});
await new Promise(r=>setTimeout(r,1200));
const arrows = await page.evaluate(`(()=>{
  const panel=document.querySelector('[role="dialog"] .max-h-\\\\[92vh\\\\]')||document.querySelector('[role="dialog"] > div > div');
  const prev=document.querySelector('[aria-label="Previous file"]');
  const next=document.querySelector('[aria-label="Next file"]');
  const pr=panel.getBoundingClientRect();
  const gap=n=>n?Math.round(Math.min(Math.abs(pr.left-n.getBoundingClientRect().right), Math.abs(n.getBoundingClientRect().left-pr.right))):null;
  return { panelLeft:Math.round(pr.left), panelRight:Math.round(pr.right),
           prevGap: prev?Math.round(pr.left - prev.getBoundingClientRect().right):null,
           nextGap: next?Math.round(next.getBoundingClientRect().left - pr.right):null };
})()`);
console.log("arrow gaps from panel edges (should be ~12px):", JSON.stringify(arrows));
await page.screenshot({ path:"/tmp/prod-arrows.jpg", type:"jpeg", quality:80 });
await b.close();
