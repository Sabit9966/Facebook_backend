import mongoose from 'mongoose';

const uri = "mongodb+srv://fireflamesabitali_db_user:dHDcvVMd%24G%402jBW@cluster0.kb4lio1.mongodb.net/facebook_ads?retryWrites=true&w=majority";

const missionSchema = new mongoose.Schema({
    keyword: String,
    status: String,
    adsFound: Number,
    newAds: Number,
    updatedAt: Date
});

const Mission = mongoose.model('Mission', missionSchema);

async function find() {
    try {
        await mongoose.connect(uri);
        const missions = await Mission.find({ keyword: "education" }).sort({ updatedAt: -1 }).limit(5);
        if (missions.length > 0) {
            console.log(`FOUND_MISSIONS: ${missions.length}`);
            missions.forEach(m => console.log(` - MISSION_DATA: ${JSON.stringify(m, null, 2)}`));
        } else {
            console.log('NO_MISSION_FOUND_WITH_MATCHING_COUNT');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

find();
