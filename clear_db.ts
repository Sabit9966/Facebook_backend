import mongoose from 'mongoose';
import { Ad, Mission } from './src/db.js';

const MONGODB_URI = "mongodb+srv://fireflamesabitali_db_user:dHDcvVMd%24G%402jBW@cluster0.kb4lio1.mongodb.net/facebook_ads?retryWrites=true&w=majority";

async function clearDB() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);

        console.log('Deleting all Ads...');
        const adResult = await Ad.deleteMany({});
        console.log(`Successfully deleted ${adResult.deletedCount} ads.`);

        console.log('Deleting all Missions...');
        const missionResult = await Mission.deleteMany({});
        console.log(`Successfully deleted ${missionResult.deletedCount} missions.`);

        console.log('Database cleared successfully!');
    } catch (error) {
        console.error('Error clearing database:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

clearDB();
