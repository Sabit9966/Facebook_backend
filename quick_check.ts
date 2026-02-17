import mongoose from 'mongoose';

const uri = "mongodb+srv://fireflamesabitali_db_user:dHDcvVMd%24G%402jBW@cluster0.kb4lio1.mongodb.net/facebook_ads?retryWrites=true&w=majority";

const missionSchema = new mongoose.Schema({
    keyword: String,
    status: String,
    startTime: Date
});

const Mission = mongoose.model('Mission', missionSchema);

async function check() {
    try {
        await mongoose.connect(uri);
        const running = await Mission.find({ status: 'running' });
        if (running.length > 0) {
            console.log(`FOUND_RUNNING_MISSIONS: ${running.length}`);
            running.forEach(m => console.log(` - ${m.keyword} (Started: ${m.startTime})`));
        } else {
            console.log('NO_RUNNING_MISSIONS');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

check();
