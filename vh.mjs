import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, args:["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1000, height: 640, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000", { waitUntil:"networkidle2", timeout:60000 });
// wait for "image" to be the current word
for (let i=0;i<12;i++){ const w=await page.evaluate(`(()=>{const h=document.querySelector('h1'); return h?h.innerText.replace(/\\s+/g,' '):'';})()`);
  if (/image/.test(w)) break; await new Promise(r=>setTimeout(r,700)); }
const h1 = await page.$('h1');
const box = await h1.boundingBox();
await page.screenshot({ path:"/tmp/headline.png", clip:{x:box.x-10,y:box.y-10,width:box.width+20,height:box.height+20} });
console.log("captured with word:", await page.evaluate(`document.querySelector('h1').innerText.replace(/\\s+/g,' ')`));
await b.close();
