const express = require('express');
const router = express.Router();
const sarvam = require('../services/sarvam');

router.post('/generate-voiceover', async (req, res) => {
  try {
    const { script, language } = req.body;

    if (!script || !script.trim()) {
      return res.status(400).json({ error: 'Script text is required' });
    }

    const lang = (language === 'hi' || language === 'en') ? language : 'hi';

    const result = await sarvam.generateVoiceover(script.trim(), lang);

    res.json({
      filename: result.filename,
      duration: result.duration
    });
  } catch (error) {
    console.error('Voiceover generation error:', error.message);
    if (error.message.includes('API key') || error.message.includes('not configured')) {
      return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
    }
    if (error.message.includes('quota') || error.message.includes('rate')) {
      return res.status(429).json({ error: 'Service is temporarily busy. Please try again in a moment.' });
    }
    res.status(500).json({ error: 'Failed to generate voiceover. Please try again.' });
  }
});

router.get('/audio/:filename', (req, res) => {
  const filepath = require('path').join(__dirname, '..', 'temp', req.params.filename);
  if (require('fs').existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ error: 'Audio file not found' });
  }
});

module.exports = router;