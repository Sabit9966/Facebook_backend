import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply stealth plugin
try {
  chromium.use(stealthPlugin());
} catch (error) {
  console.warn('Warning: Could not apply stealth plugin:', error);
}

export interface GoogleAdSuggestion {
  advertiserName: string;
  basedIn: string;
  numberOfAds: number;
}

export class GoogleAdsScraper {
  private browser: any = null;
  private browserPromise: Promise<any> | null = null;

  async initialize() {
    if (this.browserPromise) return this.browserPromise;

    this.browserPromise = (async () => {
      try {
        console.log('🚀 Launching Google Ads browser...');
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
          ]
        });
        console.log('✅ Browser launched');
        return this.browser;
      } catch (error) {
        this.browserPromise = null;
        console.error('❌ Failed to launch browser:', error);
        throw error;
      }
    })();

    return this.browserPromise;
  }

  private async getNewPage() {
    await this.initialize();
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Stealth: block resources (optional but helpful)
    await page.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media'].includes(type)) return route.abort();
      route.continue();
    });

    return page;
  }

  async fetchSuggestions(keyword: string): Promise<GoogleAdSuggestion[]> {
    let page = null;
    try {
      page = await this.getNewPage();
      console.log(`🔍 Suggestions for: "${keyword}"`);

      await page.goto(`https://adstransparency.google.com/?region=IN`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Target the specific selector from user HTML
      const input = page.locator('.input-area, input[type="text"], input[placeholder*="advertiser"]').first();
      await input.waitFor({ state: 'visible', timeout: 15000 });
      await input.click();
      await input.fill(keyword);
      await page.waitForTimeout(2000);

      const suggestionSelectors = [
        'material-select-search-option',
        '[role="option"]',
        '.suggestion-item',
        'ul[role="listbox"] li',
        '.advertisers-list div'
      ];
      let suggestions: GoogleAdSuggestion[] = [];

      for (const selector of suggestionSelectors) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          for (const el of elements.slice(0, 8)) {
            const text = await el.textContent();
            if (text) {
              const lines = text.trim().split('\n').map((l: string) => l.trim()).filter((l: string) => l);
              const advertiserName = lines[0] || '';
              let basedIn = 'Unknown', numberOfAds = 0;
              for (const line of lines) {
                if (line.toLowerCase().includes('based in')) basedIn = line.split('based in')[1]?.trim() || 'Unknown';
                if (line.toLowerCase().includes('ads')) {
                  const m = line.match(/(\d+)/);
                  if (m) numberOfAds = parseInt(m[1]);
                }
              }
              if (advertiserName && !suggestions.find(s => s.advertiserName === advertiserName)) {
                suggestions.push({ advertiserName, basedIn, numberOfAds });
              }
            }
          }
          if (suggestions.length > 0) break;
        }
      }
      return suggestions;
    } catch (error: any) {
      console.error('❌ Suggestions error:', error.message);
      return [];
    } finally {
      if (page) {
        await page.close();
        await page.context().close();
      }
    }
  }

  async scrapeAds(keyword: string, maxAds: number = 1000): Promise<any[]> {
    let page = null;
    try {
      page = await this.getNewPage();
      console.log(`🚀 Scraping: "${keyword}" (IN region)`);

      await page.goto(`https://adstransparency.google.com/?region=IN`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      const input = page.locator('.input-area, input[type="text"], input[placeholder*="advertiser"]').first();
      await input.waitFor({ state: 'visible', timeout: 15000 });
      await input.click();
      await input.fill(keyword);
      await page.waitForTimeout(2500);

      const suggestionSelectors = [
        'material-select-search-option',
        '[role="option"]',
        '.suggestion-item',
        '.advertisers-list div'
      ];
      let clicked = false;
      for (const selector of suggestionSelectors) {
        const list = await page.locator(selector).all();
        if (list.length > 0) {
          console.log(`🖱️ Clicking suggestion: ${await list[0].textContent()}`);
          await list[0].click();
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        console.log('⚠️ No suggestion found, pressing Enter...');
        await input.press('Enter');
      }

      console.log('⏳ Waiting for ads grid to load...');
      // Wait for any ad container to appear
      const gridSelector = 'priority-creative-grid, creative-grid, creative-grid-group, [role="grid"], .ads-container, .results-grid';
      await page.waitForSelector(gridSelector, { timeout: 20000 }).catch(() => console.log('⚠️ Grid selector timeout, trying immediate extraction...'));

      // Extra wait for some JS rendering
      await page.waitForTimeout(5000);

      // Extract Advertiser Header Info
      let advertiserLegalName = '';
      let basedInCountry = '';

      try {
        console.log('🔍 Attempting to extract advertiser info...');

        // Wait specifically for the info container if it's slow
        await page.waitForSelector('.advertiser-info-container, .advertiser-info', { timeout: 10000 }).catch(() => console.log('⚠️ Advertiser info container not found within timeout'));

        // Target the specific classes provided by the user
        const legalNameEl = page.locator('.legal-name').first();
        const locationEl = page.locator('.location').first();

        const [legalText, locationText] = await Promise.all([
          legalNameEl.count().then((c: number) => c > 0 ? legalNameEl.textContent() : ''),
          locationEl.count().then((c: number) => c > 0 ? locationEl.textContent() : '')
        ]);

        if (legalText) {
          // Remove "Legal name:" prefix and clean up
          advertiserLegalName = legalText.replace(/Legal name:\s*/i, '').trim().split('\n')[0];
        }

        if (locationText) {
          // Remove "Based in:" prefix and clean up
          basedInCountry = locationText.replace(/Based in:\s*/i, '').trim().split('\n')[0];
        }

        // Fallback: If direct targeting failed, try broad container search
        if (!advertiserLegalName || !basedInCountry) {
          const container = page.locator('.advertiser-info-container, .advertiser-info').first();
          const containerText = await container.count().then((c: number) => c > 0 ? container.textContent() : '');

          if (containerText) {
            if (!advertiserLegalName) {
              const legalMatch = containerText.match(/Legal name:\s*(.+)/i);
              if (legalMatch) advertiserLegalName = legalMatch[1].trim().split('\n')[0];
            }
            if (!basedInCountry) {
              const countryMatch = containerText.match(/Based in:\s*(.+)/i);
              if (countryMatch) basedInCountry = countryMatch[1].trim().split('\n')[0];
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Error extracting advertiser header info:', e);
      }

      console.log(`ℹ️ Final Extraction - Legal: ${advertiserLegalName || 'Unknown'}, Country: ${basedInCountry || 'Unknown'}`);

      const adSelectors = [
        'creative-preview',
        'creative-grid-group > div',
        'creative-grid > div',
        '[role="article"]',
        '.ad-container',
        '[data-testid*="ad"]',
        'mat-card',
        '.creative-container'
      ];
      let ads: any[] = [];
      const seenAdIds = new Set<string>();
      let noNewAdsCount = 0;
      let lastAdsCount = 0;

      console.log(`🎯 Targeted ads count: ${maxAds}`);

      while (ads.length < maxAds && noNewAdsCount < 5) {
        // Scroll to load new ads
        await page.evaluate(() => window.scrollBy(0, 2000));
        await page.waitForTimeout(2000);

        for (const selector of adSelectors) {
          const elements = await page.locator(selector).all();
          for (const el of elements) {
            try {
              const adData = await this.extractAdData(el);
              if (adData && adData.id && !seenAdIds.has(adData.id)) {
                seenAdIds.add(adData.id);
                ads.push({
                  ...adData,
                  keyword,
                  scrape_date: new Date(),
                  source: 'google_ads',
                  advertiser_legal_name: advertiserLegalName || adData.advertiser_name,
                  based_in_country: basedInCountry || 'India'
                });

                if (ads.length >= maxAds) {
                  console.log(`✅ Reached maxAds limit: ${ads.length}`);
                  return ads;
                }
              }
            } catch (e) { continue; }
          }
        }

        if (ads.length === lastAdsCount) {
          noNewAdsCount++;
          console.log(`⏳ No new ads found (${noNewAdsCount}/5)...`);
        } else {
          noNewAdsCount = 0;
          console.log(`📈 Progress: ${ads.length}/${maxAds} ads found`);
        }
        lastAdsCount = ads.length;
      }

      return ads;
    } catch (error: any) {
      console.error('❌ Scrape error:', error.message);
      throw error;
    } finally {
      if (page) {
        await page.close();
        await page.context().close();
      }
    }
  }

  private async extractAdData(element: any): Promise<any | null> {
    try {
      const text = await element.textContent();
      if (!text) return null;

      const advertiserName = await this.extractTextBySelectors(element, [
        '.advertiser-name',
        '[data-testid*="advertiser"]',
        '[data-testid*="name"]',
        'h1', 'h2', 'h3'
      ]) || 'Unknown';

      const adDescription = await this.extractTextBySelectors(element, [
        '[data-testid*="description"]',
        '.ad-description',
        'p', 'div'
      ]) || (await element.getAttribute('aria-label')) || '';

      const creativeLink = await element.locator('a').first().getAttribute('href').catch(() => null);
      const previewImage = await element.locator('img').first().getAttribute('src').catch(() => null);

      return {
        advertiser_name: advertiserName,
        ad_description: adDescription,
        phone: '',
        address: '',
        landing_url: creativeLink ? `https://adstransparency.google.com${creativeLink}` : '',
        image_url: previewImage || '',
        ad_id: creativeLink?.split('/').pop() || ''
      };
    } catch (error) {
      return null;
    }
  }

  private async extractTextBySelectors(element: any, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const found = await element.locator(selector).first();
        if (await found.isVisible()) {
          return await found.textContent();
        }
      } catch (err) {
        continue;
      }
    }
    return null;
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.browserPromise = null;
        console.log('✅ Google Ads scraper closed');
      }
    } catch (error) {
      console.error('❌ Error closing Google Ads scraper:', error);
    }
  }
}

export default GoogleAdsScraper;
