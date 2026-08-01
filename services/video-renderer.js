const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const TEMP_DIR = path.join(__dirname, '..', 'temp');

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function createSrt(sentences, durationPerSentence, audioDuration) {
  const totalDuration = Math.min(sentences.length * durationPerSentence, audioDuration);
  const adjustedDuration = totalDuration / sentences.length;

  return sentences.map((sentence, i) => {
    const start = i * adjustedDuration;
    const end = Math.min((i + 1) * adjustedDuration, audioDuration);
    const startTime = formatTime(start);
    const endTime = formatTime(end);
    return `${i + 1}\n${startTime} --> ${endTime}\n${sentence}\n`;
  }).join('\n');
}

function createBgColorsFFmpeg(sentences, audioDuration, srtPath) {
  const colors = [
    '0x0F0F1A', '0x1A1A2E', '0x16213E', '0x0A1628',
    '0x1B1464', '0x2C1B5E', '0x1A1A3E', '0x0D1B2A'
  ];
  const fps = 30;
  const totalFrames = Math.ceil(audioDuration * fps);
  const framesPerSentence = Math.ceil(totalFrames / sentences.length);

  const filterParts = [];
  let inputIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const color = colors[i % colors.length];
    const duration = Math.min(framesPerSentence / fps, audioDuration - i * (framesPerSentence / fps));
    if (duration <= 0) break;

    filterParts.push(
      `color=c=${color}:s=1080x1920:d=${duration}:r=${fps}[bg${i}]`
    );
    inputIndex++;
  }

  const concatInputs = sentences.map((_, i) => `[bg${i}]`).join('');
  const concatParts = sentences.map((_, i) => {
    const duration = Math.min(framesPerSentence / fps, audioDuration - i * (framesPerSentence / fps));
    return `[bg${i}]trim=duration=${duration}[bg${i}t]`;
  }).join(';');

  const concatFilter = `[bg0t]${sentences.slice(1).map((_, i) => `[bg${i + 1}t]`).join('')}concat=n=${sentences.length}:v=1:a=0[base]`;

  const subtitlesFilter = `[base]subtitles=${srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}:force_style='FontSize=42,FontName=Noto+Sans+Devanagari,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=3,Shadow=2,MarginV=120'[v]`;

  return `${concatParts};${concatFilter};${subtitlesFilter}`;
}

async function renderVideo(script, voiceoverPath, bgMusicPath, options = {}) {
  const { onProgress } = options;
  const jobId = uuidv4();

  const sentences = script
    .split(/[.!?\n]+/)
    .map(s => s.trim().replace(/[।!?]$/, ''))
    .filter(s => s.length > 3);

  if (sentences.length === 0) {
    sentences.push(script.substring(0, 100));
  }

  const srtPath = path.join(TEMP_DIR, `captions-${jobId}.srt`);
  const outputPath = path.join(TEMP_DIR, `output-${jobId}.mp4`);

  if (onProgress) onProgress(1, 'Analyzing audio duration...');

  let audioDuration = 0;
  try {
    const probeOutput = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceoverPath}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    audioDuration = parseFloat(probeOutput.trim()) || 30;
  } catch (e) {
    audioDuration = 30;
  }

  if (onProgress) onProgress(2, 'Generating subtitles...');

  const durationPerSentence = audioDuration / sentences.length;
  const srtContent = createSrt(sentences, durationPerSentence, audioDuration);
  fs.writeFileSync(srtPath, srtContent, 'utf8');

  if (onProgress) onProgress(3, 'Rendering video with captions...');

  const bgColor = '0x1a1a2e';
  const escapedSrtPath = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\''");

  let ffmpegCmd;
  if (bgMusicPath && fs.existsSync(bgMusicPath)) {
    ffmpegCmd = `ffmpeg -y \
      -f lavfi -i "color=c=${bgColor}:s=1080x1920:d=${audioDuration}:r=30" \
      -i "${voiceoverPath}" \
      -i "${bgMusicPath}" \
      -filter_complex "[0:v]subtitles='${escapedSrtPath}':force_style='FontSize=42,FontName=Noto+Sans+Devanagari,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=3,Shadow=2,MarginV=120'[v];[1:a][2:a]amix=inputs=2:duration=first:weights=1 0.25[a]" \
      -map "[v]" -map "[a]" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 128k \
      -pix_fmt yuv420p \
      -movflags +faststart \
      "${outputPath}"`;
  } else {
    ffmpegCmd = `ffmpeg -y \
      -f lavfi -i "color=c=${bgColor}:s=1080x1920:d=${audioDuration}:r=30" \
      -i "${voiceoverPath}" \
      -filter_complex "[0:v]subtitles='${escapedSrtPath}':force_style='FontSize=42,FontName=Noto+Sans+Devanagari,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=3,Shadow=2,MarginV=120'[v]" \
      -map "[v]" -map "1:a" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 128k \
      -pix_fmt yuv420p \
      -movflags +faststart \
      "${outputPath}"`;
  }

  return new Promise((resolve, reject) => {
    const proc = exec(ffmpegCmd, { timeout: 300000, maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Video rendering failed: ${error.message}`));
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error('Video rendering failed: output file not created'));
        return;
      }

      if (onProgress) onProgress(4, 'Finalizing video...');

      const stats = fs.statSync(outputPath);
      if (stats.size < 1000) {
        reject(new Error('Video rendering failed: output file too small'));
        return;
      }

      resolve(outputPath);
    });

    proc.stderr.on('data', (data) => {
      const match = data.toString().match(/time=(\d+:\d+:\d+\.\d+)/);
      if (match) {
        const parts = match[1].split(':');
        const currentSecs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
        const progress = Math.min(95, Math.round((currentSecs / audioDuration) * 100));
        if (onProgress) onProgress(3, `Rendering video... ${progress}%`);
      }
    });
  });
}

function cleanup(files) {
  for (const file of files) {
    try {
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    } catch (e) {}
  }
}

module.exports = { renderVideo, cleanup };