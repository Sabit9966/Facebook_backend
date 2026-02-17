import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { connectDB, Ad, Mission, Scheduler, registerUser, verifyUser } from './src/db.js';
import { schedulerService } from './src/scheduler.js';
import GoogleAdsScraper from './src/googleAdsScraper.js';
import { requireAuth, signToken } from './src/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Maps for scraper management (missionId -> scraper info)
const activeFacebookScrapers = new Map();
const activeGoogleScrapers = new Map();

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🌊 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// CORS configuration: localhost + Render frontend URL from env
const corsOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175'
];
if (process.env.FRONTEND_URL) {
    corsOrigins.push(process.env.FRONTEND_URL);
}
app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check for Render
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'facebook-backend', timestamp: new Date().toISOString() });
});

// Auth: login (no auth required)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ error: 'Username is required' });
        }
        if (!password || typeof password !== 'string' || password.length === 0) {
            return res.status(400).json({ error: 'Password is required' });
        }
        const verifiedUsername = await verifyUser(username, password);
        if (!verifiedUsername) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = signToken(verifiedUsername);
        return res.json({ token, userId: verifiedUsername });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Login failed' });
    }
});

// Auth: register (no auth required)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || typeof username !== 'string' || username.trim().length < 2) {
            return res.status(400).json({ error: 'Username must be at least 2 characters' });
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, hyphens, and underscores' });
        }
        const user = await registerUser(username, password);
        const token = signToken(user.username);
        return res.json({ token, userId: user.username });
    } catch (err) {
        if (err.message === 'USERNAME_TAKEN') {
            return res.status(409).json({ error: 'Username is already taken' });
        }
        console.error('Registration error:', err);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('API connected to MongoDB');
        console.log('Database Name:', mongoose.connection.name);
        const count = await Ad.countDocuments();
        console.log('Ad model collection:', Ad.collection.name);
        console.log('Total ads in DB:', count);
    })
    .catch(err => console.error('MongoDB connection error:', err));

// API Routes (all data routes require auth and are scoped by req.userId)
app.get('/api/ads', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const userId = req.userId;

        const filter = { userId };
        const total = await Ad.countDocuments(filter);
        console.log(`GET /api/ads - Page: ${page}, Limit: ${limit}, Total: ${total}`);

        const ads = await Ad.find(filter)
            .sort({ scrape_date: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            ads,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch ads' });
    }
});

// Get unique keywords for filtering (user-scoped)
app.get('/api/keywords', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const filter = { userId };
        const keywords = await Ad.distinct('keyword', filter);
        res.json(keywords.filter(Boolean));
    } catch (err) {
        console.error('Keywords fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch keywords' });
    }
});

app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const filter = { userId };
        const count = await Ad.countDocuments(filter);
        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.post('/api/scrape', requireAuth, async (req, res) => {
    const { keyword, maxAdsPerRequest, dailyLimit } = req.body;
    const filters = req.body.filters || {};
    const userId = req.userId;
    if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

    // Validate limits
    const maxAds = maxAdsPerRequest || 1000;
    const dailyQuota = dailyLimit || 5000;

    if (maxAds > 10000000) {
        return res.status(400).json({ error: 'maxAdsPerRequest cannot exceed 10,000,000' });
    }
    if (dailyQuota > 10000000) {
        return res.status(400).json({ error: 'dailyLimit cannot exceed 10,000,000' });
    }

    // Parallel scraping enabled: Removing single-instance lock

    // Automatic Resume Logic: If no date filters are provided, check for existing ads (user-scoped)
    const userFilter = { userId };
    if (!filters.startDate && !filters.endDate) {
        try {
            const oldestAd = await Ad.findOne({ keyword: keyword, ...userFilter })
                .sort({ ad_start_date: 1 })
                .exec();

            if (oldestAd && oldestAd.ad_start_date) {
                const endDate = oldestAd.ad_start_date.toISOString().split('T')[0];
                filters.endDate = endDate;
                console.log(`📡 [Auto-Resume] Found existing data. Setting End Date filter to ${endDate} to skip newer ads.`);
            }
        } catch (dbError) {
            console.warn('⚠️ [Auto-Resume] Failed to check for existing ads:', dbError.message);
        }
    }

    // isScraping = true; // Removed global lock
    // currentKeyword = keyword; // Tracked per mission
    console.log(`🚀 Triggering background scrape for: ${keyword} (Max: ${maxAds}, Daily: ${dailyQuota})`);
    if (filters) {
        console.log(`🔍 Filters applied:`, filters);
    }

    // Create mission record with dynamic limits (tied to user for data isolation)
    const mission = new Mission({
        userId,
        keyword,
        status: 'running',
        startTime: new Date(),
        maxAdsPerRequest: maxAds,
        dailyLimit: dailyQuota,
        country: filters?.country || 'IN',
        source: 'facebook'
    });
    await mission.save();

    // Build scraper arguments with filters
    const scraperArgs = ['tsx', 'src/scraper.ts', `"${keyword}"`, '--max-ads', maxAds.toString(), '--daily-limit', dailyQuota.toString(), '--mission-id', mission._id.toString()];

    // Add filter arguments if provided
    if (filters) {
        if (filters.language) scraperArgs.push('--language', filters.language);
        if (filters.advertiser) scraperArgs.push('--advertiser', filters.advertiser);
        if (filters.platforms && filters.platforms.length > 0) {
            scraperArgs.push('--platforms', filters.platforms.join(','));
        }
        if (filters.mediaType) scraperArgs.push('--media-type', filters.mediaType);
        if (filters.activeStatus) scraperArgs.push('--active-status', filters.activeStatus);
        if (filters.startDate) scraperArgs.push('--start-date', filters.startDate);
        if (filters.endDate) {
            scraperArgs.push('--end-date', filters.endDate);
            // If this was an auto-resume (filters added by server, not user), also pass it as --resume-date for safety
            if (!req.body.filters?.endDate) {
                scraperArgs.push('--resume-date', filters.endDate);
            }
        }
        if (filters.country) {
            scraperArgs.push('--country', filters.country);
        }
    }

    // Update mission status immediately to show as active
    await Mission.findByIdAndUpdate(mission._id, {
        $set: {
            status: 'running',
            updatedAt: new Date()
        }
    });

    // Spawn scraper process with dynamic parameters and filters
    // Explicitly pass env so the child process uses the same MONGODB_URI
    const scraper = spawn('npx', scraperArgs, {
        shell: true,
        detached: false,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env }
    });

    // Store reference in Map for multi-process management
    activeFacebookScrapers.set(mission._id.toString(), {
        process: scraper,
        keyword,
        mission
    });

    let stdoutBuffer = '';
    let scriptOutput = '';

    scraper.stdout.on('data', (data) => {
        const chunk = data.toString();
        scriptOutput += chunk;
        process.stdout.write(chunk); // Still show in terminal

        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop(); // Keep the last incomplete line in buffer

        lines.forEach(async (line) => {
            const currentMission = activeFacebookScrapers.get(mission._id.toString())?.mission;
            if (!currentMission) return;

            const updates = {};
            const inc = {};

            // 1. Real-time updates: increment counts only for new unique ads
            if (line.includes('NEW AD')) {
                inc.newAds = 1;
                inc.adsFound = 1; // Update "Ads Found" in UI to reflect newly saved ads
            }

            if (line.includes('DUPLICATE')) {
                inc.duplicatesSkipped = 1;
            }

            if (Object.keys(updates).length > 0 || Object.keys(inc).length > 0) {
                try {
                    await Mission.findByIdAndUpdate(mission._id, {
                        $set: {
                            ...updates,
                            updatedAt: new Date()
                        },
                        $inc: inc
                    });
                } catch (err) {
                    console.error('Error updating real-time mission metrics:', err);
                }
            }
        });

        // Also check for final result JSON in this chunk (it usually comes at the very end)
        checkFinalResult();
    });

    // Parse final result JSON if available
    function checkFinalResult() {
        const missionInfo = activeFacebookScrapers.get(mission._id.toString());
        if (!missionInfo) return;
        const currentMissionRecord = missionInfo.mission;
        const resultMatch = scriptOutput.match(/\[MISSION_RESULT_JSON\] (.+)/);
        if (resultMatch) {
            try {
                const result = JSON.parse(resultMatch[1]);
                // Ensure "Ads Found" reflects "New Ads" even in the final summary
                currentMissionRecord.adsFound = Math.max(currentMissionRecord.adsFound || 0, result.saved || 0);
                currentMissionRecord.newAds = Math.max(currentMissionRecord.newAds || 0, result.saved || 0);
            } catch (e) {
                // Ignore parse errors if JSON is incomplete in this chunk
            }
        }
    }

    scraper.stderr.on('data', (data) => {
        const output = data.toString();
        scriptOutput += output;
        process.stderr.write(output);
    });

    scraper.on('close', async (code) => {
        const missionInfo = activeFacebookScrapers.get(mission._id.toString());
        console.log(`🏁 Scraper for ${keyword} finished with code ${code}`);

        // Final check for results
        checkFinalResult();

        if (missionInfo && missionInfo.mission) {
            const currentMissionRecord = missionInfo.mission;
            console.log(`💾 Finalizing mission: adsFound=${currentMissionRecord.adsFound}, newAds=${currentMissionRecord.newAds}`);

            let finalStatus = code === 0 ? 'completed' : (code === null ? 'stopped' : 'failed');

            try {
                await Mission.findByIdAndUpdate(currentMissionRecord._id, {
                    $set: {
                        status: finalStatus,
                        endTime: new Date(),
                        updatedAt: new Date()
                    }
                });
            } catch (err) {
                console.error('Error finalizing mission:', err);
            }
        }

        // Remove from active scrapers
        activeFacebookScrapers.delete(mission._id.toString());
    });

    res.json({ message: 'Scrape started successfully', keyword, missionId: mission._id });
});

app.post('/api/scrape/stop', requireAuth, async (req, res) => {
    const { missionId } = req.body;
    const userId = req.userId;

    if (missionId) {
        const missionInfo = activeFacebookScrapers.get(missionId);
        if (!missionInfo) {
            return res.status(404).json({ error: 'Mission not found or not running' });
        }
        const mission = await Mission.findById(missionId);
        if (mission && mission.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden: cannot stop another user\'s scrape' });
        }
        await stopFacebookScraper(missionId, missionInfo);
        return res.json({ message: 'Scraper stopped successfully', missionId });
    } else {
        if (activeFacebookScrapers.size === 0) {
            return res.status(400).json({ error: 'No active Facebook scrapers to stop' });
        }
        const stopPromises = [];
        for (const [id, info] of activeFacebookScrapers.entries()) {
            const mission = await Mission.findById(id);
            if (mission && mission.userId !== userId) continue;
            stopPromises.push(stopFacebookScraper(id, info));
        }
        await Promise.all(stopPromises);
        return res.json({ message: `Stopped ${stopPromises.length} active scrapers` });
    }
});

async function stopFacebookScraper(id, info) {
    try {
        console.log(`🛑 Stopping Facebook scraper process for mission ${id}...`);

        // Update mission status
        try {
            await Mission.findByIdAndUpdate(id, {
                $set: {
                    status: 'stopped',
                    endTime: new Date(),
                    updatedAt: new Date()
                }
            });
            console.log(`✅ Mission marked as stopped in DB: ${id}`);
        } catch (err) {
            console.error('Error stopping mission in DB:', err);
        }

        // Windows-compatible process termination
        if (info.process) {
            if (process.platform === 'win32') {
                return new Promise((resolve) => {
                    exec(`taskkill /pid ${info.process.pid} /T /F`, (error) => {
                        if (error) console.error('Error killing process:', error);
                        activeFacebookScrapers.delete(id);
                        resolve();
                    });
                });
            } else {
                info.process.kill('SIGTERM');
                activeFacebookScrapers.delete(id);
            }
        }
    } catch (err) {
        console.error(`Error stopping scraper ${id}:`, err);
    }
}


app.get('/api/missions', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const filter = { userId };
        const missions = await Mission.find(filter).sort({ startTime: -1 }).limit(50);
        res.json(missions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch missions' });
    }
});

app.get('/api/scrape/status', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const activeMissions = [];
        let totalAdsFound = 0;
        let totalNewAds = 0;
        let mostRecentKeyword = null;

        const sortedMissions = Array.from(activeFacebookScrapers.entries()).sort((a, b) => b[1].mission.startTime - a[1].mission.startTime);

        for (const [id, info] of sortedMissions) {
            const mission = await Mission.findById(id);
            if (mission && mission.userId === userId) {
                totalAdsFound += mission.adsFound || 0;
                totalNewAds += mission.newAds || 0;
                if (!mostRecentKeyword) mostRecentKeyword = info.keyword;
                activeMissions.push({
                    missionId: id,
                    keyword: info.keyword,
                    stats: {
                        adsFound: mission.adsFound || 0,
                        newAds: mission.newAds || 0
                    }
                });
            }
        }

        res.json({
            isScraping: activeMissions.length > 0,
            activeMissions,
            count: activeMissions.length,
            currentKeyword: mostRecentKeyword,
            stats: {
                adsFound: totalAdsFound,
                newAds: totalNewAds
            }
        });
    } catch (err) {
        console.error('Error fetching status:', err);
        res.json({ isScraping: false, activeMissions: [], count: 0, currentKeyword: null, stats: { adsFound: 0, newAds: 0 } });
    }
});

// Delete single ad (only own ads)
app.delete('/api/ads/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const ad = await Ad.findById(id);
        if (!ad) return res.status(404).json({ error: 'Ad not found' });
        if (ad.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden: cannot delete another user\'s ad' });
        }
        await Ad.findByIdAndDelete(id);
        res.json({ message: 'Ad deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete ad' });
    }
});

// Bulk delete ads (only own ads)
app.post('/api/ads/batch-delete', requireAuth, async (req, res) => {
    try {
        const { ids } = req.body;
        const userId = req.userId;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid IDs provided' });
        }
        const filter = { _id: { $in: ids }, userId };
        const result = await Ad.deleteMany(filter);
        res.json({ message: 'Ads deleted successfully', count: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: 'Failed to batch delete ads' });
    }
});

// Delete single mission (only own)
app.delete('/api/missions/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const mission = await Mission.findById(id);
        if (!mission) return res.status(404).json({ error: 'Mission not found' });
        if (mission.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden: cannot delete another user\'s mission' });
        }
        await Mission.findByIdAndDelete(id);
        res.json({ message: 'Mission deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete mission' });
    }
});

// Get ads by keyword (user-scoped)
app.get('/api/ads/keyword/:keyword', requireAuth, async (req, res) => {
    try {
        const { keyword } = req.params;
        const userId = req.userId;
        const filter = { keyword: decodeURIComponent(keyword), userId };
        const ads = await Ad.find(filter).sort({ scrape_date: -1 });
        res.json(ads);
    } catch (err) {
        console.error('Fetch ads by keyword error:', err);
        res.status(500).json({ error: 'Failed to fetch ads by keyword' });
    }
});

// Bulk delete missions (only own)
app.post('/api/missions/batch-delete', requireAuth, async (req, res) => {
    try {
        const { ids } = req.body;
        const userId = req.userId;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid IDs provided' });
        }
        const filter = { _id: { $in: ids }, userId };
        const result = await Mission.deleteMany(filter);
        res.json({ message: 'Missions deleted successfully', count: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: 'Failed to batch delete missions' });
    }
});

// Scheduler API endpoints (user-scoped)
app.get('/api/schedulers', requireAuth, async (req, res) => {
    try {
        const schedulers = await schedulerService.getSchedulers(req.userId);
        res.json(schedulers);
    } catch (err) {
        console.error('Fetch schedulers error:', err);
        res.status(500).json({ error: 'Failed to fetch schedulers' });
    }
});

app.post('/api/schedulers', requireAuth, async (req, res) => {
    try {
        const { keyword, cronExpression, maxAdsPerRequest, dailyLimit } = req.body;
        if (!keyword || !cronExpression) {
            return res.status(400).json({ error: 'Keyword and cron expression are required' });
        }
        if (!cron.validate(cronExpression)) {
            return res.status(400).json({ error: 'Invalid cron expression' });
        }
        const scheduler = await schedulerService.addScheduler(keyword, cronExpression, maxAdsPerRequest || 100, dailyLimit || 1000, req.userId);
        res.json(scheduler);
    } catch (err) {
        console.error('Create scheduler error:', err);
        res.status(500).json({ error: 'Failed to create scheduler' });
    }
});

app.put('/api/schedulers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const scheduler = await schedulerService.updateScheduler(id, updates, req.userId);
        if (!scheduler) {
            return res.status(404).json({ error: 'Scheduler not found' });
        }
        res.json({ message: 'Scheduler updated successfully', scheduler });
    } catch (err) {
        console.error('Update scheduler error:', err);
        res.status(500).json({ error: 'Failed to update scheduler' });
    }
});

app.delete('/api/schedulers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await schedulerService.deleteScheduler(id, req.userId);
        res.json({ message: 'Scheduler deleted successfully' });
    } catch (err) {
        console.error('Delete scheduler error:', err);
        res.status(500).json({ error: 'Failed to delete scheduler' });
    }
});

app.get('/api/schedulers/status', requireAuth, async (req, res) => {
    try {
        const status = schedulerService.getJobStatus();
        const activeJobs = await schedulerService.getActiveJobs();
        res.json({ ...status, activeJobs });
    } catch (err) {
        console.error('Get scheduler status error:', err);
        res.status(500).json({ error: 'Failed to get scheduler status' });
    }
});

// Google Ads API endpoints (authenticated, user-scoped)
app.get('/api/google-ads/suggestions/:keyword', requireAuth, async (req, res) => {
    try {
        const { keyword } = req.params;

        if (!keyword || keyword.length < 2) {
            return res.status(400).json({ error: 'Keyword must be at least 2 characters long' });
        }

        console.log(`🔍 Fetching Google Ads suggestions for: "${keyword}"`);
        const suggestions = await googleAdsScraper.fetchSuggestions(keyword);

        res.json({ suggestions, keyword });
    } catch (err) {
        console.error('Google Ads suggestions error:', err);
        res.status(500).json({
            error: 'Failed to fetch Google Ads suggestions',
            details: err instanceof Error ? err.message : String(err)
        });
    }
});

app.post('/api/google-ads/scrape', requireAuth, async (req, res) => {
    const { keyword, maxAdsPerRequest, dailyLimit } = req.body;
    const userId = req.userId;

    if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
    }

    const maxAds = maxAdsPerRequest || 1000;
    const dailyQuota = dailyLimit || 5000;

    if (maxAds > 10000000) {
        return res.status(400).json({ error: 'maxAdsPerRequest cannot exceed 10,000,000' });
    }
    if (dailyQuota > 10000000) {
        return res.status(400).json({ error: 'dailyLimit cannot exceed 10,000,000' });
    }

    const mission = new Mission({
        userId,
        keyword: `google_${keyword}`,
        status: 'running',
        startTime: new Date(),
        maxAdsPerRequest: maxAds,
        dailyLimit: dailyQuota,
        source: 'google_ads'
    });
    await mission.save();

    const scraperInstance = new GoogleAdsScraper();
    activeGoogleScrapers.set(mission._id.toString(), {
        scraper: scraperInstance,
        keyword,
        mission
    });

    console.log(`🚀 Starting parallel Google Ads scrape for: "${keyword}" (Mission: ${mission._id})`);

    // Start scraping in background
    (async () => {
        try {
            const ads = await scraperInstance.scrapeAds(keyword, maxAds);

            // Update stats
            mission.adsFound = ads.length;
            mission.newAds = 0; // Initialize

            let savedCount = 0;
            const ownerId = mission.userId || null;
            for (const adData of ads) {
                try {
                    const doc = { ...adData };
                    if (ownerId) doc.userId = ownerId;
                    const ad = new Ad(doc);
                    await ad.save();
                    savedCount++;
                } catch (saveErr) {
                    console.error('Error saving ad:', saveErr);
                }
            }

            // Update mission final result
            try {
                mission.newAds = savedCount;
                mission.status = 'completed';
                mission.endTime = new Date();
                await mission.save();
                console.log(`✅ Google Ads scrape completed: ${ads.length} found, ${savedCount} saved`);
            } catch (missionErr) {
                console.error('Error saving final mission status:', missionErr);
            }
        } catch (error) {
            console.error(`❌ [${mission._id}] Google Ads scrape failed:`, error);
            try {
                mission.status = 'failed';
                mission.endTime = new Date();
                await mission.save();
            } catch (missionErr) {
                console.error('Error updating failed mission status:', missionErr);
            }
        } finally {
            activeGoogleScrapers.delete(mission._id.toString());
            await scraperInstance.close();
        }
    })().catch(err => {
        console.error('🔥 Fatal error in Google Ads background task:', err);
        activeGoogleScrapers.delete(mission._id.toString());
    });

    res.json({
        message: 'Google Ads scrape started successfully',
        keyword,
        missionId: mission._id
    });
});

app.get('/api/google-ads/status', requireAuth, async (req, res) => {
    const userId = req.userId;
    const activeMissions = [];
    for (const [id, info] of activeGoogleScrapers.entries()) {
        const mission = await Mission.findById(id);
        if (mission && mission.userId === userId) {
            activeMissions.push({
                missionId: id,
                keyword: info.keyword,
                status: 'running'
            });
        }
    }
    res.json({
        isScraping: activeGoogleScrapers.size > 0,
        activeMissions,
        count: activeGoogleScrapers.size
    });
});

app.post('/api/google-ads/stop', requireAuth, async (req, res) => {
    const { missionId } = req.body;
    const userId = req.userId;

    if (missionId) {
        const info = activeGoogleScrapers.get(missionId);
        if (!info) {
            return res.status(404).json({ error: 'Google Ads mission not found or not running' });
        }
        const mission = await Mission.findById(missionId);
        if (mission && mission.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden: cannot stop another user\'s scrape' });
        }
        await stopGoogleScraper(missionId, info);
        return res.json({ message: 'Google Ads scraper stopped successfully', missionId });
    } else {
        if (activeGoogleScrapers.size === 0) {
            return res.status(400).json({ error: 'No active Google Ads scrape to stop' });
        }

        const stopPromises = [];
        for (const [id, info] of activeGoogleScrapers.entries()) {
            stopPromises.push(stopGoogleScraper(id, info));
        }
        await Promise.all(stopPromises);
        return res.json({ message: `Stopped ${stopPromises.length} Google Ads scrapers` });
    }
});

async function stopGoogleScraper(id, info) {
    try {
        console.log(`🛑 Stopping Google Ads scraper for mission ${id}...`);

        // Update mission status
        try {
            await Mission.findByIdAndUpdate(id, {
                $set: {
                    status: 'stopped',
                    endTime: new Date(),
                    updatedAt: new Date()
                }
            });
        } catch (dbErr) {
            console.error('Error updating Google mission stop in DB:', dbErr);
        }

        if (info.scraper) {
            await info.scraper.close();
        }
        activeGoogleScrapers.delete(id);
    } catch (err) {
        console.error(`Error stopping Google scraper ${id}:`, err);
    }
}

// Production-level error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        path: req.path
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');

    // Stop Facebook scrapers
    for (const [id, info] of activeFacebookScrapers.entries()) {
        await stopFacebookScraper(id, info);
    }

    // Stop Google scrapers
    for (const [id, info] of activeGoogleScrapers.entries()) {
        await stopGoogleScraper(id, info);
    }

    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');

    // Stop Facebook scrapers
    for (const [id, info] of activeFacebookScrapers.entries()) {
        await stopFacebookScraper(id, info);
    }

    // Stop Google scrapers
    for (const [id, info] of activeGoogleScrapers.entries()) {
        await stopGoogleScraper(id, info);
    }

    mongoose.connection.close().then(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    }).catch(err => {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
    });
});

app.listen(Number(PORT) || 5001, '0.0.0.0', async () => {
    console.log(`🚀 Production-ready server running on http://localhost:${PORT}`);
    console.log(`📊 API Endpoints:`);
    console.log(`   GET  /api/ads - Fetch all ads`);
    console.log(`   GET  /api/ads/keyword/:keyword - Fetch ads by keyword`);
    console.log(`   GET  /api/stats - Get statistics`);
    console.log(`   POST /api/scrape - Start scraping with dynamic limits`);
    console.log(`   POST /api/scrape/stop - Stop scraping`);
    console.log(`   GET  /api/scrape/status - Get scraping status`);
    console.log(`   GET  /api/missions - Fetch all missions`);
    console.log(`   DELETE /api/missions/:id - Delete single mission`);
    console.log(`   POST /api/missions/batch-delete - Bulk delete missions`);
    console.log(`   DELETE /api/ads/:id - Delete single ad`);
    console.log(`   POST /api/ads/batch-delete - Bulk delete ads`);
    console.log(`   GET  /api/schedulers - Fetch all schedulers`);
    console.log(`   POST /api/schedulers - Create new scheduler`);
    console.log(`   PUT  /api/schedulers/:id - Update scheduler`);
    console.log(`   DELETE /api/schedulers/:id - Delete scheduler`);
    console.log(`   GET  /api/schedulers/status - Get scheduler status`);

    // Initialize the scheduler service
    try {
        await schedulerService.start();
        console.log(`📅 Enhanced Scheduler service initialized successfully`);
    } catch (error) {
        console.error(`❌ Failed to initialize scheduler:`, error);
    }
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Error: Port ${PORT} is already in use. Please kill the process using it or use a different port.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});
