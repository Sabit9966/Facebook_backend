import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Ad } from './src/db.js';

dotenv.config();

async function checkStats() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);

        const targetDateStart = new Date('2026-02-11T00:00:00Z');
        const targetDateEnd = new Date('2026-02-11T23:59:59Z');

        const count = await Ad.countDocuments({
            scrape_date: { $gte: targetDateStart, $lte: targetDateEnd }
        });

        console.log('TOTAL_ADS_FEB_11:', count);

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
            startTime: { $gte: targetDateStart, $lte: targetDateEnd }
        });

        console.log('MISSIONS_FEB_11:', missions.length);
        missions.forEach(m => {
            console.log(` - ${m.keyword}: status=${m.status}, newAds=${m.newAds}, limit=${m.maxAdsPerRequest}/${m.dailyLimit}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

checkStats();
