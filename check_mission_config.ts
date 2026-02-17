import mongoose from 'mongoose';

const uri = "mongodb+srv://fireflamesabitali_db_user:dHDcvVMd%24G%402jBW@cluster0.kb4lio1.mongodb.net/facebook_ads?retryWrites=true&w=majority";

const missionSchema = new mongoose.Schema({
    keyword: String,
    maxAdsPerRequest: Number,
    dailyLimit: Number,
    adsFound: Number,
    newAds: Number,
    status: String
});

const Mission = mongoose.model('Mission', missionSchema);

async function checkConfig() {
    try {
        await mongoose.connect(uri);
        // Using the ID found in previous step: 698c02709904c6fe97cdb93d
        const mission = await Mission.findById('698c02709904c6fe97cdb93d');
        if (mission) {
            console.log('--- Mission Config ---');
            console.log(`Keyword: ${mission.keyword}`);
            console.log(`Max Ads (maxAdsPerRequest): ${mission.maxAdsPerRequest}`);
            console.log(`Daily Limit: ${mission.dailyLimit}`);
            console.log(`Ads Found: ${mission.adsFound}`);
            console.log(`New Ads: ${mission.newAds}`);
            console.log(`Status: ${mission.status}`);
        } else {
            console.log('Mission not found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

checkConfig();
