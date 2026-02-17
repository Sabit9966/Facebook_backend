import mongoose from 'mongoose';

const AdSchema = new mongoose.Schema({
    advertiser_name: String,
    ad_description: String,
    ad_start_date: Date,
    keyword: String,
    scrape_date: Date
});

const Ad = mongoose.models.Ad || mongoose.model('Ad', AdSchema);

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/facebook-scraper');
    console.log('--- Latest 10 Ads ---');
    const ads = await Ad.find().sort({ scrape_date: -1 }).limit(10);
    ads.forEach(ad => {
        console.log(`Advertiser: [${ad.advertiser_name}], Keyword: ${ad.keyword}, ID: ${ad._id}`);
    });
    await mongoose.disconnect();
}

check().catch(console.error);
