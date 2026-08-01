const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function generateScript(topic, language, duration) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const durationText = { 30: '30 seconds', 60: '60 seconds', 90: '90 seconds' }[duration] || `${duration} seconds`;

  const langInstructions = {
    'hi': `Write the script in natural conversational Hindi (Devanagari script). Use simple, engaging Hindi that feels native, not translated. The script should be 100-150 words. Start with a strong hook.`,
    'en': `Write the script in natural English. The script should be 100-150 words. Start with a strong hook.`
  };

  const langInstruction = langInstructions[language] || langInstructions['hi'];
  const langName = { 'hi': 'Hindi', 'en': 'English' }[language] || 'Hindi';

  const systemPrompt = `You are a professional video script writer for faceless YouTube Shorts and Instagram Reels. Your scripts are engaging, concise, and optimized for ${durationText} short-form videos.

${langInstruction}

STRUCTURE:
- Start with a STRONG HOOK (first 3-5 seconds) that grabs attention
- Main content: 2-3 key points
- End with a CTA or memorable closing line

FORMAT: Return ONLY the script text, no explanations, no meta-commentary. Use short sentences. Keep it conversational and engaging.`;

  const userPrompt = `Write a ${durationText} faceless video script in ${langName} about: "${topic}"`;

  const response = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
      }],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 512
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = 'Gemini API request failed';
    try {
      const err = JSON.parse(errorBody);
      if (err.error?.message) message = err.error.message;
    } catch (e) {}
    throw new Error(message);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return text.trim();
}

module.exports = { generateScript };