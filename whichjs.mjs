import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true, args:["--no-sandbox"] });
for (const route of ["/", "/about", "/privacy"]) {
  const page = await b.newPage();
  const got = [];
  page.on("response", r => { if (/\.js(\?|$)/.test(r.url())) got.push(r.url().split("/").pop()); });
  await page.goto("http://localhost:3000"+route, { waitUntil:"networkidle2", timeout:60000 });
  await new Promise(r=>setTimeout(r,900));
  console.log(route.padEnd(10), got.sort().join("  "));
  await page.close();
}
await b.close();
