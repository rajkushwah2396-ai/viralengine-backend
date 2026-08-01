const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const SARVAM_API_BASE = 'https://api.sarvam.ai';

async function generateVoiceover(text, language) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error('SARVAM_API_KEY not configured');
  }

  const langCode = language === 'hi' ? 'hi-IN' : 'en-IN';
  const speaker = language === 'hi' ? 'meera' : 'amol';

  const response = await fetch(`${SARVAM_API_BASE}/text-to-speech`, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: langCode,
      speaker: speaker,
      pitch: 0,
      pace: 1.0,
      loudness: 1.0,
      enable_preprocessing: true
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = 'Sarvam AI TTS request failed';
    try {
      const err = JSON.parse(errorBody);
      if (err.message) message = err.message;
      if (err.detail) message = err.detail;
    } catch (e) {}
    throw new Error(message);
  }

  const data = await response.json();

  if (!data.audio_content) {
    throw new Error('Sarvam returned no audio content');
  }

  const audioBuffer = Buffer.from(data.audio_content, 'base64');
  const filename = `voiceover-${uuidv4()}.wav`;
  const filepath = path.join(__dirname, '..', 'temp', filename);

  fs.writeFileSync(filepath, audioBuffer);

  return {
    filepath: filepath,
    filename: filename,
    duration: data.duration || estimateDuration(text)
  };
}

function estimateDuration(text) {
  const wordCount = text.split(/\s+/).length;
  return Math.max(15, wordCount / 2.5);
}

module.exports = { generateVoiceover };