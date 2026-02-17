import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://fireflamesabitali_db_user:dHDcvVMd%24G%402jBW@cluster0.kb4lio1.mongodb.net/facebook_ads?retryWrites=true&w=majority";

const adSchema = new Schema({
    userId: { type: String, index: true },
    advertiser_name: String,
    ad_description: String,
    scrape_date: { type: Date, default: Date.now },
    keyword: String,
    phone: String,
    address: String,
    image_url: String,
    landing_url: String,
    ad_id: String,
    source: { type: String, default: 'facebook' },
    advertiser_legal_name: String,
    based_in_country: String,
    ad_start_date: Date
});

// Mission schema for tracking scraping jobs
const missionSchema = new Schema({
    userId: { type: String, index: true },
    keyword: { type: String, required: true },
    status: { type: String, enum: ['running', 'completed', 'failed', 'stopped'], default: 'running' },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    adsFound: { type: Number, default: 0 },
    newAds: { type: Number, default: 0 },
    duplicatesSkipped: { type: Number, default: 0 },
    adsProcessed: { type: Number, default: 0 },
    maxAdsPerRequest: { type: Number, required: true },
    dailyLimit: { type: Number, required: true },
    country: { type: String, default: 'IN' },
    source: { type: String, default: 'facebook' },
    error: { type: String },
    executionId: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Scheduler configuration schema
const schedulerSchema = new Schema({
    userId: { type: String, index: true },
    keyword: { type: String, required: true },
    cronExpression: { type: String, required: true }, // e.g., '0 */6 * * *' for every 6 hours
    isActive: { type: Boolean, default: false },
    maxAdsPerRequest: { type: Number, default: 1000 },
    dailyLimit: { type: Number, default: 5000 },
    lastRun: { type: Date },
    nextRun: { type: Date },
    totalRuns: { type: Number, default: 0 },
    successfulRuns: { type: Number, default: 0 },
    failedRuns: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// User schema for authentication
const userSchema = new Schema({
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Ad = mongoose.model('Ad', adSchema);
const Mission = mongoose.model('Mission', missionSchema);
const Scheduler = mongoose.model('Scheduler', schedulerSchema);
const User = mongoose.model('User', userSchema);

export { Ad, Mission, Scheduler, User };

export async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    await mongoose.connect(MONGODB_URI);
}

/**
 * Saves an ad. userId is required for data isolation; ads are de-duplicated per user.
 */
export async function saveAd(
    advertiser: string,
    description: string,
    keyword: string,
    phone: string | null,
    address: string | null,
    startDate?: Date | null,
    userId?: string | null
): Promise<boolean> {
    try {
        await connectDB();

        const filter: Record<string, unknown> = {
            advertiser_name: advertiser,
            ad_description: description
        };
        if (userId != null) filter.userId = userId;

        const existing = await Ad.findOne(filter);
        if (existing) {
            console.log(`[Skip] Ad already exists: ${advertiser}`);
            return false;
        }

        const adData: Record<string, unknown> = {
            advertiser_name: advertiser,
            ad_description: description,
            keyword,
            phone,
            address,
            ad_start_date: startDate
        };
        if (userId != null) adData.userId = userId;

        const ad = new Ad(adData);
        await ad.save();
        console.log(`[Save] New ad stored: ${advertiser}`);
        return true;
    } catch (err) {
        console.error('Error saving to MongoDB:', err);
        return false;
    }
}

/**
 * Returns mission by id; used by scraper to get userId for saveAd isolation.
 */
export async function getMissionById(missionId: string): Promise<{ userId?: string | null } | null> {
    try {
        await connectDB();
        const mission = await Mission.findById(missionId).lean();
        return mission ? { userId: mission.userId } : null;
    } catch (err) {
        console.error('Error fetching mission:', err);
        return null;
    }
}

export async function getStats(userId?: string | null) {
    await connectDB();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const filter: Record<string, unknown> = { scrape_date: { $gte: startOfDay } };
    if (userId != null) filter.userId = userId;
    return await Ad.countDocuments(filter);
}

export async function updateMission(missionId: string, updates: any) {
    try {
        await connectDB();
        await Mission.findByIdAndUpdate(missionId, {
            ...updates,
            updatedAt: new Date()
        });
    } catch (err) {
        console.error('Error updating mission in MongoDB:', err);
    }
}

const SALT_ROUNDS = 10;

/**
 * Registers a new user. Returns the created user doc or throws USERNAME_TAKEN.
 */
export async function registerUser(username: string, password: string): Promise<{ username: string }> {
    await connectDB();
    const normalizedUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
        throw new Error('USERNAME_TAKEN');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = new User({ username: normalizedUsername, passwordHash });
    await user.save();
    return { username: user.username };
}

/**
 * Verifies credentials. Returns the username if valid, or null if invalid.
 */
export async function verifyUser(username: string, password: string): Promise<string | null> {
    await connectDB();
    const normalizedUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: normalizedUsername });
    if (!user) return null;
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    return isMatch ? user.username : null;
}
