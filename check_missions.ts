import mongoose from 'mongoose';
import { Mission, connectDB } from './src/db.js';

async function checkMissions() {
    await connectDB();
    const missions = await Mission.find().sort({ createdAt: -1 }).limit(5);
    console.log('Recent Missions:');
    missions.forEach(m => {
        console.log(`- ID: ${m._id}, Keyword: ${m.keyword}, Status: ${m.status}, Ads Found: ${m.adsFound}, Created: ${m.createdAt}`);
    });
    process.exit(0);
}

checkMissions();
