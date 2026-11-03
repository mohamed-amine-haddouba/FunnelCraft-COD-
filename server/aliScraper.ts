export async function extractAliExpressImages(html: string, targetUrl: string): Promise<string[]> {
  let images: string[] = [];

  const runParamsMatch = html.match(/window\.runParams\s*=\s*(\{.*?\});/s);
  if (runParamsMatch) {
    try {
      const runParams = JSON.parse(runParamsMatch[1]);
      const imagePathList =
        runParams?.data?.imageModule?.imagePathList || runParams?.data?.imageModule?.mainImages;
      if (Array.isArray(imagePathList) && imagePathList.length > 0) {
        images = imagePathList;
      }
    } catch {
      // Ignore parse error
    }
  }

  // Extract only from the HTML already downloaded via the public-address transport.
  const uniqueImages = Array.from(new Set(images));
  return uniqueImages.map((url) => {
    let cleanUrl = url;
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    cleanUrl = cleanUrl.replace(/_\d+x\d+(\.(jpg|png|webp))/i, '$1');
    return cleanUrl;
  });
}
