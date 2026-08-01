const express = require('express');
const router = express.Router();
const path = require('path');
const renderer = require('../services/video-renderer');

router.post('/render-video', async (req, res) => {
  try {
    const { script, voiceoverFilename, bgMusic } = req.body;

    if (!script || !script.trim()) {
      return res.status(400).json({ error: 'Script is required' });
    }
    if (!voiceoverFilename) {
      return res.status(400).json({ error: 'Voiceover filename is required' });
    }

    const voiceoverPath = path.join(__dirname, '..', 'temp', voiceoverFilename);
    if (!require('fs').existsSync(voiceoverPath)) {
      return res.status(404).json({ error: 'Voiceover file not found. Please regenerate voiceover.' });
    }

    let bgMusicPath = null;
    if (bgMusic !== false) {
      const defaultMusicPath = path.join(__dirname, '..', '..', 'sfx', 'background-music.wav');
      if (require('fs').existsSync(defaultMusicPath)) {
        bgMusicPath = defaultMusicPath;
      }
    }

    const outputPath = await renderer.renderVideo(script.trim(), voiceoverPath, bgMusicPath, {
      onProgress: (step, message) => {
        if (req.progressCallback) {
          req.progressCallback(step, message);
        }
      }
    });

    res.json({ videoFilename: path.basename(outputPath) });
  } catch (error) {
    console.error('Video rendering error:', error.message);
    res.status(500).json({ error: 'Failed to render video. Please try again.' });
  }
});

router.get('/video/:filename', (req, res) => {
  const filepath = path.join(__dirname, '..', 'temp', req.params.filename);
  if (require('fs').existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ error: 'Video file not found' });
  }
});

module.exports = router;