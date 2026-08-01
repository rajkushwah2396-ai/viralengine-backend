const express = require('express');
const router = express.Router();
const gemini = require('../services/gemini');

router.post('/generate-script', async (req, res) => {
  try {
    const { topic, language, duration } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const validLanguages = ['hi', 'en'];
    const lang = validLanguages.includes(language) ? language : 'hi';
    const dur = [30, 60, 90].includes(duration) ? duration : 60;

    const script = await gemini.generateScript(topic.trim(), lang, dur);

    res.json({ script });
  } catch (error) {
    console.error('Script generation error:', error.message);
    if (error.message.includes('API key') || error.message.includes('not configured')) {
      return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
    }
    if (error.message.includes('SAFETY') || error.message.includes('blocked')) {
      return res.status(400).json({ error: 'This topic could not be processed. Please try a different topic.' });
    }
    if (error.message.includes('quota') || error.message.includes('rate')) {
      return res.status(429).json({ error: 'Service is temporarily busy. Please try again in a moment.' });
    }
    res.status(500).json({ error: 'Failed to generate script. Please try again.' });
  }
});

module.exports = router;