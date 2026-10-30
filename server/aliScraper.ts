import { chromium } from 'playwright';

export async function extractAliExpressImages(html: string, targetUrl: string): Promise<string[]> {
  let images: string[] = [];

  const runParamsMatch = html.match(/window\.runParams\s*=\s*(\{.*?\});/s);
  if (runParamsMatch) {
    try {
      const runParams = JSON.parse(runParamsMatch[1]);
      const imagePathList = runParams?.data?.imageModule?.imagePathList || runParams?.data?.imageModule?.mainImages;
      if (Array.isArray(imagePathList) && imagePathList.length > 0) {
        images = imagePathList;
      }
    } catch (e) {}
  }

  if (images.length < 3) {
    try {
      console.log('[SCRAPER] Falling back to Playwright for AliExpress...');
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(4000);
      const renderedHtml = await page.content();
      const renderedMatch = renderedHtml.match(/window\.runParams\s*=\s*(\{.*?\});/s);
      if (renderedMatch) {
        const runParams = JSON.parse(renderedMatch[1]);
        const imagePathList = runParams?.data?.imageModule?.imagePathList;
        if (Array.isArray(imagePathList)) images = imagePathList;
      }
      if (images.length < 3) {
        const domImages = await page.$$eval('img', (imgs) => 
           imgs.map(img => img.src).filter(src => src.includes('aliexpress-media.com') || src.includes('alicdn.com'))
        );
        images = domImages;
      }
      await browser.close();
    } catch (e) {
      console.error('[SCRAPER] Playwright fallback failed:', e);
    }
  }

  const uniqueImages = Array.from(new Set(images));
  return uniqueImages.map(url => {
    let cleanUrl = url;
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    cleanUrl = cleanUrl.replace(/_\d+x\d+(\.(jpg|png|webp))/i, '$1');
    return cleanUrl;
  });
}
