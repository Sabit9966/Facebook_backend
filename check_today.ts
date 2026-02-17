import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Ad } from './src/db.js';

dotenv.config();

async function checkTodayStats() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const count = await Ad.countDocuments({
            scrape_date: { $gte: startOfDay }
        });

        console.log('TOTAL_ADS_TODAY:', count);

        // Also check missions today
        const missionSchema = new mongoose.Schema({
            keyword: String,
            status: String,
            startTime: Date,
            newAds: Number,
            maxAdsPerRequest: Number,
            dailyLimit: Number
        });
        const Mission = mongoose.models.Mission || mongoose.model('Mission', missionSchema);

        const missions = await Mission.find({
            startTime: { $gte: startOfDay }
        });

        console.log('MISSIONS_TODAY:', missions.length);
        missions.forEach(m => {
            console.log(` - ${m.keyword}: status=${m.status}, newAds=${m.newAds}, limit=${m.maxAdsPerRequest}/${m.dailyLimit}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

checkTodayStats();
