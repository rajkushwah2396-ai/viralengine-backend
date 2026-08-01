require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const scriptRoutes = require('./routes/script');
const voiceoverRoutes = require('./routes/voiceover');
const videoRoutes = require('./routes/video');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:8081', 'http://localhost:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:8080'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api', scriptRoutes);
app.use('/api', voiceoverRoutes);
app.use('/api', videoRoutes);

function isConfigured(value) {
  if (!value) return false;
  const s = String(value).trim();
  if (!s) return false;
  return !/^your_/i.test(s) && !/^<.*>$/i.test(s) && !/^here$/i.test(s);
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: isConfigured(process.env.GEMINI_API_KEY),
    sarvamConfigured: isConfigured(process.env.SARVAM_API_KEY),
    ffmpegAvailable: checkFfmpeg()
  });
});

function checkFfmpeg() {
  try {
    require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

app.listen(PORT, () => {
  console.log(`ViralEngine AI Server running on port ${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Gemini API: ${isConfigured(process.env.GEMINI_API_KEY) ? '✓ configured' : '✗ not configured'}`);
  console.log(`Sarvam API: ${isConfigured(process.env.SARVAM_API_KEY) ? '✓ configured' : '✗ not configured'}`);
  console.log(`FFmpeg: ${checkFfmpeg() ? '✓ available' : '✗ not found'}`);
});