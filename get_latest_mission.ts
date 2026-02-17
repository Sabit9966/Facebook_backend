import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MissionSchema = new mongoose.Schema({
    keyword: String,
    status: String,
    startTime: Date
});

const Mission = mongoose.models.Mission || mongoose.model('Mission', MissionSchema);

async function check() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const mission = await Mission.findOne().sort({ startTime: -1 });
    if (mission) {
        console.log(`LATEST_MISSION_ID:${mission._id}`);
    } else {
        console.log('NO_MISSIONS_FOUND');
    }
    await mongoose.disconnect();
}

check().catch(console.error);
