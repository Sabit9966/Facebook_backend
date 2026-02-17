import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { config, getSearchUrl, getSearchUrlWithFilters } from './config.js';
import { saveAd, getStats, updateMission, getMissionById } from './db.js';
import process from 'node:process';

chromium.use(stealth());

// Optimized scraper configuration
const getDefaultScraperConfig = () => ({
    maxAds: 100,
    scrollDelay: 600,           // Reduced: poll-based scroll detection makes fixed delay less critical
    maxScrollAttempts: 50000,
    batchProcessingSize: 50,    // Increased: batch extraction is now cheap (single evaluate call)
    memoryCleanupInterval: 20,  // Less frequent: every 20 batches instead of 5
    maxExecutionTime: 600 * 60 * 1000, // 10 hours
    errorRetryAttempts: 5,
    errorRetryDelay: 10000,
    healthCheckInterval: 30000,
    refreshInterval: 3000,      // Increased: less frequent page reloads (every 3000 ads)
    navigationTimeout: 20000,
    elementWaitTimeout: 10000,
    dailyLimitCheckInterval: 10 // Check daily limit every N batches instead of every batch
});

const createScraperConfig = () => {
    const defaultConfig = getDefaultScraperConfig();
    const envConfig = {
        maxAds: process.env.SCRAPER_MAX_ADS ? parseInt(process.env.SCRAPER_MAX_ADS) : defaultConfig.maxAds,
        scrollDelay: process.env.SCRAPER_SCROLL_DELAY ? parseInt(process.env.SCRAPER_SCROLL_DELAY) : defaultConfig.scrollDelay,
        maxScrollAttempts: process.env.SCRAPER_MAX_SCROLL_ATTEMPTS ? parseInt(process.env.SCRAPER_MAX_SCROLL_ATTEMPTS) : defaultConfig.maxScrollAttempts,
        batchProcessingSize: process.env.SCRAPER_BATCH_SIZE ? parseInt(process.env.SCRAPER_BATCH_SIZE) : defaultConfig.batchProcessingSize,
        memoryCleanupInterval: process.env.SCRAPER_MEMORY_CLEANUP_INTERVAL ? parseInt(process.env.SCRAPER_MEMORY_CLEANUP_INTERVAL) : defaultConfig.memoryCleanupInterval,
        maxExecutionTime: process.env.SCRAPER_MAX_EXECUTION_TIME ? parseInt(process.env.SCRAPER_MAX_EXECUTION_TIME) : defaultConfig.maxExecutionTime,
        errorRetryAttempts: process.env.SCRAPER_ERROR_RETRY_ATTEMPTS ? parseInt(process.env.SCRAPER_ERROR_RETRY_ATTEMPTS) : defaultConfig.errorRetryAttempts,
        errorRetryDelay: process.env.SCRAPER_ERROR_RETRY_DELAY ? parseInt(process.env.SCRAPER_ERROR_RETRY_DELAY) : defaultConfig.errorRetryDelay,
        healthCheckInterval: process.env.SCRAPER_HEALTH_CHECK_INTERVAL ? parseInt(process.env.SCRAPER_HEALTH_CHECK_INTERVAL) : defaultConfig.healthCheckInterval
    };

    return {
        maxAds: Math.max(1, Math.min(10000000, envConfig.maxAds)),
        scrollDelay: Math.max(300, Math.min(30000, envConfig.scrollDelay)),
        maxScrollAttempts: Math.max(5, Math.min(100000, envConfig.maxScrollAttempts)),
        batchProcessingSize: Math.max(10, Math.min(500, envConfig.batchProcessingSize)),
        memoryCleanupInterval: Math.max(1, Math.min(50, envConfig.memoryCleanupInterval)),
        maxExecutionTime: Math.max(300000, Math.min(36000000, envConfig.maxExecutionTime)),
        errorRetryAttempts: Math.max(0, Math.min(10, envConfig.errorRetryAttempts)),
        errorRetryDelay: Math.max(1000, Math.min(60000, envConfig.errorRetryDelay)),
        healthCheckInterval: Math.max(10000, Math.min(300000, envConfig.healthCheckInterval)),
        refreshInterval: defaultConfig.refreshInterval,
        navigationTimeout: process.env.SCRAPER_NAV_TIMEOUT ? parseInt(process.env.SCRAPER_NAV_TIMEOUT) : defaultConfig.navigationTimeout,
        elementWaitTimeout: process.env.SCRAPER_ELEMENT_TIMEOUT ? parseInt(process.env.SCRAPER_ELEMENT_TIMEOUT) : defaultConfig.elementWaitTimeout,
        dailyLimitCheckInterval: defaultConfig.dailyLimitCheckInterval
    };
};

const scraperConfig = createScraperConfig();

function parseArgs() {
    const args = process.argv.slice(2);
    const params: any = {
        keyword: '',
        maxAds: config.maxAdsPerDay,
        dailyLimit: config.maxAdsPerDay,
        customConfig: {},
        missionId: null,
        resumeDate: null,
        filters: { country: config.country }
    };

    let keywordParts: string[] = [];
    for (let i = 0; i < args.length; i++) {
        const currentArg = args[i];
        if (!currentArg) continue;
        if (currentArg === '--max-ads' && i + 1 < args.length) { params.maxAds = parseInt(args[++i] || '1000'); }
        else if (currentArg === '--daily-limit' && i + 1 < args.length) { params.dailyLimit = parseInt(args[++i] || '5000'); }
        else if (currentArg === '--language' && i + 1 < args.length) { params.filters.language = args[++i]; }
        else if (currentArg === '--advertiser' && i + 1 < args.length) { params.filters.advertiser = args[++i]; }
        else if (currentArg === '--platforms' && i + 1 < args.length) { params.filters.platforms = args[++i]?.split(',') || []; }
        else if (currentArg === '--media-type' && i + 1 < args.length) { params.filters.mediaType = args[++i]; }
        else if (currentArg === '--active-status' && i + 1 < args.length) { params.filters.activeStatus = args[++i]; }
        else if (currentArg === '--start-date' && i + 1 < args.length) { params.filters.startDate = args[++i]; }
        else if (currentArg === '--end-date' && i + 1 < args.length) { params.filters.endDate = args[++i]; }
        else if (currentArg === '--country' && i + 1 < args.length) { params.filters.country = args[++i]; }
        else if (currentArg === '--mission-id' && i + 1 < args.length) { params.missionId = args[++i]; }
        else if (currentArg === '--resume-date' && i + 1 < args.length) {
            const dateVal = args[++i];
            if (dateVal) params.resumeDate = new Date(dateVal);
        }
        else if (currentArg.startsWith('--')) continue;
        else keywordParts.push(currentArg);
    }
    params.keyword = keywordParts.join(' ');
    return params;
}

async function scrapeAds(keyword: string, maxAds: number, dailyLimit: number, filters?: any, missionId?: string | null, resumeDate: Date | null = null) {
    const startTime = Date.now();
    const executionId = missionId || `scrape_${keyword}_${startTime}`;
    let userId: string | null = null;
    if (missionId) {
        const mission = await getMissionById(missionId);
        if (mission && mission.userId != null) userId = mission.userId;
        console.log(`🔑 [${executionId}] Mission lookup: ${mission ? 'found' : 'NOT FOUND'}, userId: "${userId}"`);
    }
    let browser: any = null, context: any = null, page: any = null;
    let healthCheckTimer: any = null, memoryCleanupTimer: any = null;

    const stats = { savedCount: 0, duplicateCount: 0, processedCount: 0, scrollAttempts: 0, errorCount: 0, memoryCleanups: 0, lastProgressTime: Date.now(), batchesProcessed: 0 };

    try {
        console.log(`🌐 [${executionId}] Launching optimized browser (DB: ${process.env.MONGODB_URI ? 'env' : 'hardcoded'})...`);
        browser = await chromium.launch({
            headless: config.headless,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ignoreHTTPSErrors: true
        });
        page = await context.newPage();

        // Block heavy resources to speed up page loads
        // NOTE: Do NOT block 'stylesheet' — Facebook's React SPA needs CSS to render ad cards
        await page.route('**/*', (route: any) => {
            const type = route.request().resourceType();
            if (['image', 'font', 'media'].includes(type)) {
                return route.abort();
            }
            return route.continue();
        });

        // Inject card-finding helpers into the browser context so page.evaluate() can use them
        await page.addInitScript(() => {
            // Find the best root container for ad cards
            (window as any).__getAdRoot = function(): Element {
                // Try known container selectors in order of specificity
                return document.querySelector('[role="main"]')
                    || document.querySelector('[data-testid="ad_library_main_content"]')
                    || document.querySelector('[data-testid="search_results_container"]')
                    || document.body;
            };

            (window as any).__findAdCards = function(root?: Element): Element[] {
                const searchRoot = root || (window as any).__getAdRoot();

                // Strategy 1: data-testid (most stable)
                const testIdCards = searchRoot.querySelectorAll('[data-testid="fb-ad-library-ad-card"]');
                if (testIdCards.length > 0) return Array.from(testIdCards);

                // Strategy 2: Structural — containers with "See ad details" / "Ad details" links
                // This is the MOST RELIABLE strategy when [role="main"] doesn't exist
                const allLinks = searchRoot.querySelectorAll('a, span, div');
                const adDetailContainers: Element[] = [];
                const seen = new Set<Element>();
                for (const link of allLinks) {
                    const text = (link.textContent || '').trim().toLowerCase();
                    if (text === 'see ad details' || text === 'ad details' || text === 'see summary details') {
                        // Walk up to find the card container
                        let parent: Element | null = link as Element;
                        for (let i = 0; i < 12 && parent; i++) {
                            parent = parent.parentElement;
                            if (!parent || parent === searchRoot || parent === document.body) break;
                            // Ad cards are sizeable containers
                            const rect = parent.getBoundingClientRect();
                            if (rect.width > 200 && rect.height > 100) {
                                // Check if this container has sibling containers of similar size (ad cards are siblings)
                                const parentEl = parent.parentElement;
                                if (parentEl && !seen.has(parent)) {
                                    seen.add(parent);
                                    adDetailContainers.push(parent);
                                }
                                break;
                            }
                        }
                    }
                }
                if (adDetailContainers.length > 0) return adDetailContainers;

                // Strategy 3: obfuscated class selectors (only if scoped root exists, NOT from body)
                if (searchRoot !== document.body) {
                    const classCards = searchRoot.querySelectorAll('div.xh8yej3, div.x1plvlek');
                    const filtered: Element[] = Array.from<Element>(classCards).filter((c) => (c.textContent || '').length > 50);
                    if (filtered.length > 0) return filtered;
                }

                // Strategy 4: Find the results list container — look for a parent that holds multiple card-like children
                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                    const children = Array.from(div.children);
                    if (children.length < 3 || children.length > 200) continue;
                    // Check if children look like ad cards (similar structure, contain links and text)
                    let cardLikeCount = 0;
                    for (const child of children) {
                        const hasLink = child.querySelector('a');
                        const textLen = (child.textContent || '').length;
                        const rect = child.getBoundingClientRect();
                        if (hasLink && textLen > 100 && rect.height > 80) cardLikeCount++;
                    }
                    // If >60% of children look like cards, this is likely the results container
                    if (cardLikeCount >= 3 && cardLikeCount / children.length > 0.6) {
                        return children.filter((child: Element) => {
                            const hasLink = child.querySelector('a');
                            const textLen = (child.textContent || '').length;
                            return hasLink && textLen > 100;
                        });
                    }
                }

                return [];
            };
        });

        // Set faster timeouts
        page.setDefaultTimeout(scraperConfig.elementWaitTimeout);
        page.setDefaultNavigationTimeout(scraperConfig.navigationTimeout);

        healthCheckTimer = setInterval(() => {
            if (Date.now() - stats.lastProgressTime > 600000) console.warn(`⚠️ [${executionId}] No progress for 10m`);
            if (Date.now() - startTime > scraperConfig.maxExecutionTime) throw new Error('Max execution time exceeded');
        }, scraperConfig.healthCheckInterval);

        memoryCleanupTimer = setInterval(() => performMemoryCleanup(executionId, stats), 120000);

        const url = filters && Object.keys(filters).length > 0 ? getSearchUrlWithFilters(keyword, filters) : getSearchUrl(keyword, filters?.country);
        await navigateWithRetry(page, url, executionId);
        await waitForResultsWithRetry(page, executionId);

        await performEnhancedScraping(page, keyword, maxAds, dailyLimit, executionId, stats, resumeDate, userId);

        if (missionId) await updateMission(missionId, { status: 'completed', adsFound: stats.processedCount, newAds: stats.savedCount, duplicatesSkipped: stats.duplicateCount, adsProcessed: stats.processedCount, endTime: new Date() });
    } catch (error: any) {
        console.error(`❌ [${executionId}] Failed:`, error.message);
        await savePartialResults(executionId, stats, keyword, maxAds, dailyLimit, error, missionId);
    } finally {
        await cleanupResources(browser, context, page, healthCheckTimer, memoryCleanupTimer, executionId);
    }
}

/**
 * Extracts ALL visible ad card data in a single browser evaluate() call.
 * This eliminates dozens of Node↔Browser round-trips per batch.
 * Returns an array of { advertiser, description, phone } objects.
 */
async function extractAllCardsInBrowser(page: any, startIndex: number, batchSize: number): Promise<Array<{ advertiser: string; description: string; phone: string | null }>> {
    return await page.evaluate(({ startIdx, size }: { startIdx: number; size: number }) => {
        const results: Array<{ advertiser: string; description: string; phone: string | null }> = [];

        // Use the injected robust card finder (auto-detects root container)
        const allCards = (window as any).__findAdCards();

        const end = Math.min(startIdx + size, allCards.length);
        for (let i = startIdx; i < end; i++) {
            const card = allCards[i];
            if (!card) continue;

            try {
                let advertiser = '';

                // Strategy 1: h4/h3 headers (most reliable for advertiser name)
                const header = card.querySelector('h4, h3');
                if (header) {
                    advertiser = (header.textContent || '').trim();
                }

                // Strategy 2: first meaningful link text (advertiser profile link)
                if (!advertiser) {
                    const links = card.querySelectorAll('a[role="link"], a[href*="facebook.com"], span[role="button"], a');
                    const skipTexts = ['sponsored', 'active', 'inactive', 'see ad details', 'ad details', 'see summary details', 'learn more'];
                    for (const link of links) {
                        const t = (link.textContent || '').trim();
                        if (t.length > 1 && t.length < 100 && !skipTexts.includes(t.toLowerCase())) {
                            advertiser = t;
                            break;
                        }
                    }
                }

                // Strategy 3: bold text
                if (!advertiser) {
                    const bold = card.querySelector('span[style*="font-weight: 600"], span[style*="font-weight: bold"]');
                    if (bold) advertiser = (bold.textContent || '').trim();
                }

                if (!advertiser) advertiser = 'Unknown';

                // Extract description — try pre-wrap first, then any large text block
                let description = '';
                const descEl = card.querySelector('div[style*="white-space: pre-wrap"]');
                if (descEl) {
                    description = (descEl.textContent || '').trim();
                } else {
                    // Fallback: find the longest text block in the card (likely the description)
                    const divs = card.querySelectorAll('div, span');
                    let longestText = '';
                    for (const d of divs) {
                        const t = (d.textContent || '').trim();
                        if (t.length > longestText.length && t.length > 20 && t !== advertiser) {
                            longestText = t;
                        }
                    }
                    description = longestText;
                }

                // Extract phone (Indian format)
                let phone: string | null = null;
                const phoneMatch = description.match(/(?:\+91[\-\s]?)?[6-9]\d{9}/);
                if (phoneMatch) phone = phoneMatch[0];

                results.push({ advertiser, description, phone });
            } catch {
                // Skip cards that fail extraction
            }
        }

        return results;
    }, { startIdx: startIndex, size: batchSize });
}

/**
 * Finds ad card elements using multiple strategies (most stable first).
 * Returns the matched elements. Used by both getCardCount and extractAllCardsInBrowser.
 */
/**
 * Gets the count of ad cards currently in the DOM via a fast evaluate call.
 * Uses the injected __findAdCards helper with 4-strategy fallback.
 */
async function getCardCount(page: any): Promise<number> {
    return await page.evaluate(() => {
        return (window as any).__findAdCards().length;
    });
}

async function performEnhancedScraping(page: any, keyword: string, maxAds: number, dailyLimit: number, executionId: string, stats: any, resumeDate: Date | null, userId: string | null = null) {
    if (resumeDate) await performSafetyScroll(page, resumeDate, executionId);

    let emptyBatchPatience = 0;
    const maxEmptyBatchPatience = 5;
    let scrollFailCount = 0;
    const maxScrollFails = 8; // Allow multiple scroll failures before giving up
    let pageRefreshCount = 0;
    const maxPageRefreshes = 3;

    while (stats.savedCount < maxAds && stats.scrollAttempts < scraperConfig.maxScrollAttempts) {
        stats.lastProgressTime = Date.now();
        if (stats.batchesProcessed > 0 && stats.batchesProcessed % scraperConfig.memoryCleanupInterval === 0) {
            await performMemoryCleanup(executionId, stats);
        }

        // Fast card count via single evaluate call
        const count = await getCardCount(page);

        console.log(`🔄 [${executionId}] Batch ${stats.batchesProcessed + 1}: Found ${count} cards (processed ${stats.processedCount}), Saved: ${stats.savedCount}/${maxAds}`);

        if (count === 0) {
            emptyBatchPatience++;

            // Diagnostic: on first empty batch, log what's actually on the page
            if (stats.batchesProcessed === 0 && emptyBatchPatience === 1) {
                const diag = await page.evaluate(() => {
                    const main = document.querySelector('[role="main"]');
                    const findAdCardsResult = typeof (window as any).__findAdCards === 'function'
                        ? (window as any).__findAdCards().length : -1;
                    let seeAdDetails = 0;
                    document.querySelectorAll('a, span, div').forEach((el: Element) => {
                        const t = (el.textContent || '').trim().toLowerCase();
                        if (t === 'see ad details' || t === 'ad details') seeAdDetails++;
                    });
                    return {
                        hasMain: !!main,
                        findAdCardsResult,
                        bodyTextLength: document.body.textContent?.length || 0,
                        url: location.href,
                        testIdCount: document.querySelectorAll('[data-testid="fb-ad-library-ad-card"]').length,
                        seeAdDetailsCount: seeAdDetails,
                        allAnchorCount: document.querySelectorAll('a').length,
                        title: document.title,
                    };
                });
                console.log(`🔍 [${executionId}] PAGE DIAGNOSTIC:`, JSON.stringify(diag, null, 2));
            }

            if (emptyBatchPatience >= maxEmptyBatchPatience) {
                if (pageRefreshCount < maxPageRefreshes) {
                    pageRefreshCount++;
                    console.log(`📡 [${executionId}] Stuck. Refresh ${pageRefreshCount}/${maxPageRefreshes}...`);
                    await page.reload({ waitUntil: 'domcontentloaded', timeout: scraperConfig.navigationTimeout }).catch(() => { });
                    await page.waitForTimeout(3000);
                    await waitForResultsWithRetry(page, executionId).catch(() => { });
                    emptyBatchPatience = 0;
                    stats.processedCount = 0;
                    continue;
                }
                console.log(`📡 [${executionId}] Max refreshes reached with 0 cards. Stopping.`);
                break;
            }
            stats.scrollAttempts++;
            await scrollForMoreContent(page, executionId, stats);
            continue;
        }

        // Reset patience counters when we find cards
        emptyBatchPatience = 0;

        // Check if there are unprocessed cards in the current view
        const batchSize = Math.min(scraperConfig.batchProcessingSize, count - stats.processedCount);
        if (batchSize <= 0) {
            // All visible cards have been processed — need to scroll for more
            stats.scrollAttempts++;
            const scrollWorked = await scrollForMoreContent(page, executionId, stats);

            if (!scrollWorked) {
                scrollFailCount++;
                console.log(`⏳ [${executionId}] Scroll attempt ${scrollFailCount}/${maxScrollFails} found no new content`);

                if (scrollFailCount >= maxScrollFails) {
                    // Final attempt: full page reload to reset FB's virtualized list
                    if (pageRefreshCount < maxPageRefreshes) {
                        pageRefreshCount++;
                        console.log(`📡 [${executionId}] Scroll stuck. Full reload ${pageRefreshCount}/${maxPageRefreshes}...`);
                        await page.reload({ waitUntil: 'domcontentloaded', timeout: scraperConfig.navigationTimeout }).catch(() => { });
                        await page.waitForTimeout(3000);
                        await waitForResultsWithRetry(page, executionId).catch(() => { });
                        stats.processedCount = 0;
                        scrollFailCount = 0;
                        continue;
                    }
                    console.log(`📡 [${executionId}] Exhausted all scroll + refresh attempts. Stopping.`);
                    break;
                }

                // Wait a bit longer before retrying — FB lazy loading can be slow
                await new Promise(r => setTimeout(r, 2000));
            } else {
                scrollFailCount = 0; // Reset on successful scroll
            }
            continue;
        }

        // Reset scroll fail counter when we successfully process cards
        scrollFailCount = 0;

        const extractedAds = await extractAllCardsInBrowser(page, stats.processedCount, batchSize);

        // Save extracted ads
        let batchNew = 0;
        for (const adData of extractedAds) {
            if (stats.savedCount >= maxAds) break;
            try {
                if (await saveAd(adData.advertiser, adData.description, keyword, adData.phone, null, null, userId)) {
                    stats.savedCount++;
                    batchNew++;
                    console.log(`✅ [${executionId}] NEW AD [${stats.savedCount}/${maxAds}]: [${adData.advertiser}]`);
                } else {
                    stats.duplicateCount++;
                }
            } catch (e: any) {
                console.log(`❌ [${executionId}] Error saving ad: ${e.message}`);
            }
            stats.processedCount++;
        }
        stats.batchesProcessed++;

        if (batchNew > 0) {
            console.log(`📊 [${executionId}] Batch done: +${batchNew} new, ${stats.duplicateCount} dupes total`);
        }

        // Stability refresh every N saved ads
        if (batchNew > 0 && stats.savedCount > 0 && stats.savedCount % scraperConfig.refreshInterval === 0) {
            console.log(`🧹 [${executionId}] Stability refresh at ${stats.savedCount} ads...`);
            await page.reload({ waitUntil: 'domcontentloaded', timeout: scraperConfig.navigationTimeout }).catch(() => { });
            await page.waitForTimeout(3000);
            await waitForResultsWithRetry(page, executionId).catch(() => { });
            stats.processedCount = 0;
            continue;
        }

        // After processing a batch, scroll for more if we've exhausted visible cards
        if (stats.savedCount < maxAds && stats.processedCount >= count) {
            stats.scrollAttempts++;
            await scrollForMoreContent(page, executionId, stats);
        } else if (stats.savedCount >= maxAds) break;

        // Check daily limit periodically
        if (stats.batchesProcessed % scraperConfig.dailyLimitCheckInterval === 0) {
            if ((await getStats(userId)) >= dailyLimit) break;
        }
    }
}

async function scrollForMoreContent(page: any, executionId: string, stats: any) {
    // Get current card count and scroll height BEFORE scrolling
    const prevCardCount = await getCardCount(page);
    const prevH = await page.evaluate(() => {
        const h = document.body.scrollHeight;
        window.scrollTo({ top: h + 200, behavior: 'instant' });
        return h;
    });

    // Poll for new content — check BOTH scroll height change AND new card count
    // Facebook often loads new cards without changing scrollHeight
    const maxWait = 3000; // Wait up to 3 seconds for lazy content
    const pollInterval = 300;
    let elapsed = 0;

    while (elapsed < maxWait) {
        await new Promise(r => setTimeout(r, pollInterval));
        elapsed += pollInterval;

        const [newH, newCardCount] = await page.evaluate(() => {
            return [document.body.scrollHeight, typeof (window as any).__findAdCards === 'function'
                ? (window as any).__findAdCards().length : 0];
        });

        // New content detected by either height change or new cards appearing
        if (newH > prevH || newCardCount > prevCardCount) {
            console.log(`📜 [${executionId}] New content: height ${prevH}→${newH}, cards ${prevCardCount}→${newCardCount}`);
            return true;
        }
    }

    // Retry: scroll up then back down to trigger Facebook's lazy loading
    console.log(`📜 [${executionId}] No new content after scroll. Trying jiggle...`);
    await page.evaluate(() => window.scrollBy(0, -800));
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight + 200));
    await new Promise(r => setTimeout(r, 1500));

    const [finalH, finalCardCount] = await page.evaluate(() => {
        return [document.body.scrollHeight, typeof (window as any).__findAdCards === 'function'
            ? (window as any).__findAdCards().length : 0];
    });

    if (finalH > prevH || finalCardCount > prevCardCount) {
        console.log(`📜 [${executionId}] Jiggle worked: height ${prevH}→${finalH}, cards ${prevCardCount}→${finalCardCount}`);
        return true;
    }

    // Final attempt: scroll to very top then back to bottom (forces FB to recalculate)
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight + 200));
    await new Promise(r => setTimeout(r, 2000));

    const lastCardCount = await getCardCount(page);
    if (lastCardCount > prevCardCount) {
        console.log(`📜 [${executionId}] Full scroll reset worked: cards ${prevCardCount}→${lastCardCount}`);
        return true;
    }

    return false;
}

async function performMemoryCleanup(executionId: string, stats: any) {
    if (global.gc) global.gc();
    stats.memoryCleanups++;
    const mem = process.memoryUsage();
    console.log(`💾 [${executionId}] Memory: ${Math.round(mem.rss / 1024 / 1024)}MB`);
}

async function savePartialResults(_executionId: string, stats: any, _kw: string, _max: number, _daily: number, err: any, mId?: string | null) {
    if (mId) await updateMission(mId, { status: 'failed', error: err.message, adsFound: stats.processedCount, newAds: stats.savedCount, duplicatesSkipped: stats.duplicateCount, endTime: new Date() });
}

async function cleanupResources(browser: any, context: any, page: any, h: any, m: any, _id: string) {
    if (h) clearInterval(h); if (m) clearInterval(m);
    if (page) await page.close().catch(() => { });
    if (context) await context.close().catch(() => { });
    if (browser) await browser.close().catch(() => { });
}

async function navigateWithRetry(page: any, url: string, id: string) {
    console.log(`🔗 [${id}] Navigating to: ${url}`);
    const startNav = Date.now();
    try {
        // Use domcontentloaded first (faster), then let waitForResults handle SPA rendering
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: scraperConfig.navigationTimeout
        });
        console.log(`✅ [${id}] DOM loaded in ${Date.now() - startNav}ms`);
    } catch (err: any) {
        console.log(`⚠️ [${id}] DOM load timeout, trying commit...`);
        try {
            await page.goto(url, {
                waitUntil: 'commit',
                timeout: scraperConfig.navigationTimeout
            });
            console.log(`✅ [${id}] Page committed in ${Date.now() - startNav}ms`);
        } catch (err2: any) {
            console.error(`❌ [${id}] Navigation failed:`, err2.message);
            throw err2;
        }
    }
    // Give the SPA a moment to start rendering after DOM load
    await page.waitForTimeout(2000);
}

async function waitForResultsWithRetry(page: any, id: string) {
    const startWait = Date.now();
    // Increase wait timeout for initial page render — Facebook SPA can be slow
    const waitTimeout = Math.max(scraperConfig.elementWaitTimeout, 20000);
    try {
        // Wait for ad content to appear — do NOT require [role="main"] since FB may not have it
        await page.waitForFunction(() => {
            // Use the robust multi-strategy card finder if available
            if (typeof (window as any).__findAdCards === 'function') {
                return (window as any).__findAdCards().length > 0;
            }
            // Inline fallback: check for any "See ad details" text on the page
            const allEls = document.querySelectorAll('a, span, div');
            for (const el of allEls) {
                const t = (el.textContent || '').trim().toLowerCase();
                if (t === 'see ad details' || t === 'ad details') return true;
            }
            // Also check for data-testid cards
            return document.querySelectorAll('[data-testid="fb-ad-library-ad-card"]').length > 0;
        }, { timeout: waitTimeout });
        console.log(`✅ [${id}] Results ready in ${Date.now() - startWait}ms`);
    } catch {
        console.log(`⚠️ [${id}] Element wait timeout (${Date.now() - startWait}ms), continuing anyway...`);
    }
}

async function performSafetyScroll(page: any, _rd: Date, id: string) {
    await scrollForMoreContent(page, id, { savedCount: 0 });
}

async function main() {
    const p = parseArgs();
    if (!p.keyword) process.exit(1);
    await scrapeAds(p.keyword, p.maxAds, p.dailyLimit, p.filters, p.missionId, p.resumeDate);
}

main().catch(() => process.exit(1));
