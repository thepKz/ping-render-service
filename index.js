require('dotenv').config();
const axios = require('axios');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // phục vụ UI tĩnh

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 8080;
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL) || 60000; // 1 phút
const SELF_URL = process.env.SELF_URL || `http://localhost:${PORT}/health`;

//--------------------------------------------------
// 1. Kết nối MongoDB
//--------------------------------------------------
mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000, // 30s timeout để tránh treo app
}).then(() => console.log('[MongoDB] Connected'))
  .catch(err => {
      console.error('[MongoDB] Connection error:', err.message);
      process.exit(1);
  });

//--------------------------------------------------
// 2. Định nghĩa Schema + Model
//--------------------------------------------------
const linkSchema = new mongoose.Schema({
    url: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    lastPingAt: Date,
    lastStatus: Number,
    lastError: String,
});
const Link = mongoose.model('Link', linkSchema);

//--------------------------------------------------
// 3. Đảm bảo link tự ping (SELF_URL) tồn tại trong DB
//--------------------------------------------------
async function ensureSelfLink() {
    try {
        await Link.updateOne({ url: SELF_URL }, { $setOnInsert: { enabled: true } }, { upsert: true });
    } catch (err) {
        console.error('Error ensuring self link:', err.message);
    }
}

//--------------------------------------------------
// 4. API Endpoints
//--------------------------------------------------
// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get all links
app.get('/links', async (req, res) => {
    const links = await Link.find();
    res.json(links);
});

// Add new link
app.post('/links', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    try {
        const link = await Link.create({ url });
        res.status(201).json(link);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Enable/disable link
app.patch('/links/:id/enable', async (req, res) => {
    await toggleLink(req, res, true);
});
app.patch('/links/:id/disable', async (req, res) => {
    await toggleLink(req, res, false);
});
async function toggleLink(req, res, state) {
    try {
        const link = await Link.findByIdAndUpdate(req.params.id, { enabled: state }, { new: true });
        if (!link) return res.status(404).json({ error: 'Not found' });
        res.json(link);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Delete link
app.delete('/links/:id', async (req, res) => {
    try {
        await Link.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//--------------------------------------------------
// 5. Ping Logic
//--------------------------------------------------
async function pingLink(link) {
    try {
        const response = await axios.get(link.url, { timeout: 10000 });
        await Link.updateOne({ _id: link._id }, {
            lastPingAt: new Date(),
            lastStatus: response.status,
            lastError: null,
        });
        console.log(`[Ping] SUCCESS ${link.url} - ${response.status}`);
    } catch (err) {
        await Link.updateOne({ _id: link._id }, {
            lastPingAt: new Date(),
            lastStatus: err.response?.status || null,
            lastError: err.message,
        });
        console.error(`[Ping] FAIL ${link.url} - ${err.message}`);
    }
}

async function pingAllLinks() {
    const links = await Link.find({ enabled: true });
    for (const link of links) {
        await pingLink(link);
    }
}

//--------------------------------------------------
// 6. Khởi động server và vòng lặp ping
//--------------------------------------------------
app.listen(PORT, async () => {
    console.log(`Ping service API running on port ${PORT}`);
    await ensureSelfLink();
    // Ping ngay lập tức rồi setInterval
    await pingAllLinks();
    setInterval(pingAllLinks, PING_INTERVAL);
    console.log(`Start pinging every ${PING_INTERVAL/1000}s`);
}); 