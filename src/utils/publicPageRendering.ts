import type { LandingPageData } from '../types/landingPage';

/**
 * Edited block pages are the source of truth for the public site. A scraped
 * product may be present as metadata even after the merchant customizes blocks.
 * Only use the legacy product storefront if there are no editable blocks.
 */
export function shouldUseScrapedProductTemplate<
  T extends Pick<LandingPageData, 'scrapedData' | 'blocks'>
>(page: T): page is T & { scrapedData: NonNullable<LandingPageData['scrapedData']> } {
  return Boolean(page.scrapedData) && (!Array.isArray(page.blocks) || page.blocks.length === 0);
}
