import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ImageInput } from './llm/types.js';

/**
 * Video ingestion. A video is turned into searchable text two ways at once:
 * its audio track is transcribed, and a handful of frames are sampled and
 * described by a vision model (so on-screen text, slides, and diagrams are
 * captured too). This needs the `ffmpeg` binary on the host; when it is
 * missing we throw a clear, actionable error rather than degrading silently.
 */

export interface VideoDeps {
  /** Transcribe an audio clip (the engine's `transcribeAudio`). */
  transcribeAudio(audio: ImageInput): Promise<string>;
  /** OCR + describe a single frame (the engine's `describeImage`). */
  describeImage(image: ImageInput, prompt?: string): Promise<string>;
}

export interface VideoOptions {
  /** How many frames to sample across the video. Default 4, capped at 16. */
  frames?: number;
  /** Override the ffmpeg binary path (defaults to `ffmpeg` on PATH). */
  ffmpegPath?: string;
  /** Skip audio transcription (frames only). */
  noAudio?: boolean;
  /** Skip frame sampling (audio only). */
  noFrames?: boolean;
}

export interface VideoFrame {
  /** Approximate timestamp of the frame, in seconds. */
  atSec: number;
  /** The vision model's description / OCR of the frame. */
  text: string;
}

export interface VideoResult {
  transcript: string;
  frames: VideoFrame[];
  /** The combined, human-readable text stored as the memory content. */
  text: string;
  durationSec: number;
}

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

/** Whether the ffmpeg binary is callable on this host. */
export function hasFfmpeg(bin = FFMPEG): boolean {
  try {
    const r = spawnSync(bin, ['-version'], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

/** Probe a video's duration in seconds (0 if ffprobe is unavailable). */
export function probeDurationSec(path: string, bin = FFPROBE): number {
  try {
    const r = spawnSync(
      bin,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path],
      { encoding: 'utf8' },
    );
    const secs = Number.parseFloat((r.stdout || '').trim());
    return Number.isFinite(secs) ? secs : 0;
  } catch {
    return 0;
  }
}

/** Run ffmpeg with the given args, resolving on exit 0 and rejecting otherwise. */
function runFfmpeg(bin: string, args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], signal });
    let stderr = '';
    proc.stderr?.on('data', (d) => {
      stderr += String(d);
      if (stderr.length > 8192) stderr = stderr.slice(-8192);
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().split('\n').slice(-3).join(' ')}`));
    });
  });
}

/**
 * Turn a video (raw bytes) into searchable text: transcribe the audio track
 * and describe a sample of frames. Writes to a scratch dir under the OS temp
 * folder and cleans it up. Throws a clear error if ffmpeg is not installed.
 */
export async function describeVideo(
  video: ImageInput,
  deps: VideoDeps,
  opts: VideoOptions = {},
): Promise<VideoResult> {
  const bin = opts.ffmpegPath || FFMPEG;
  if (!hasFfmpeg(bin)) {
    throw new Error(
      'Video ingestion needs the ffmpeg binary, which was not found. Install it (e.g. `brew install ffmpeg` or `apt install ffmpeg`) or set FFMPEG_PATH.',
    );
  }

  const frameCount = Math.min(Math.max(opts.frames ?? 4, 1), 16);
  const ext = (video.mediaType.split('/')[1] || 'mp4').replace(/[^a-z0-9]/gi, '') || 'mp4';
  const dir = mkdtempSync(join(tmpdir(), 'companybrain-video-'));
  const videoPath = join(dir, `input.${ext}`);

  try {
    writeFileSync(videoPath, Buffer.from(video.base64, 'base64'));
    const durationSec = probeDurationSec(videoPath);

    let transcript = '';
    const frames: VideoFrame[] = [];

    // 1) Audio track -> mp3 -> transcription.
    if (!opts.noAudio) {
      const audioPath = join(dir, 'audio.mp3');
      try {
        await runFfmpeg(bin, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '96k', audioPath]);
        const audioB64 = readFileSync(audioPath).toString('base64');
        if (audioB64.length > 0) {
          transcript = (await deps.transcribeAudio({ base64: audioB64, mediaType: 'audio/mpeg' })).trim();
        }
      } catch {
        // No audio stream, or transcription unavailable: keep going with frames.
      }
    }

    // 2) Sample frames -> jpeg -> vision description.
    if (!opts.noFrames) {
      // Even fps across the whole clip so `frameCount` frames land spread out.
      const fps = durationSec > 0 ? Math.max(frameCount / durationSec, 0.01) : 1;
      await runFfmpeg(bin, [
        '-y',
        '-i',
        videoPath,
        '-vf',
        `fps=${fps.toFixed(4)},scale=768:-1`,
        '-frames:v',
        String(frameCount),
        '-q:v',
        '3',
        join(dir, 'frame-%03d.jpg'),
      ]);

      const files = readdirSync(dir)
        .filter((f) => f.startsWith('frame-') && f.endsWith('.jpg'))
        .sort();

      const step = durationSec > 0 && files.length > 0 ? durationSec / files.length : 0;
      for (let i = 0; i < files.length; i++) {
        const b64 = readFileSync(join(dir, files[i] as string)).toString('base64');
        const atSec = Math.round(step * i);
        try {
          const text = (
            await deps.describeImage(
              { base64: b64, mediaType: 'image/jpeg' },
              'This is a still frame sampled from a video. Transcribe any visible on-screen text verbatim, then briefly describe what is shown.',
            )
          ).trim();
          if (text) frames.push({ atSec, text });
        } catch {
          // Vision unavailable for this frame: skip it.
        }
      }
    }

    const text = composeVideoText(transcript, frames);
    return { transcript, frames, text, durationSec };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Pure: assemble the transcript and frame descriptions into stored content. */
export function composeVideoText(transcript: string, frames: VideoFrame[]): string {
  const parts: string[] = [];
  if (transcript) parts.push(`Transcript:\n${transcript}`);
  if (frames.length) {
    const body = frames.map((f) => `[${formatTimestamp(f.atSec)}] ${f.text}`).join('\n\n');
    parts.push(`On-screen frames:\n${body}`);
  }
  return parts.join('\n\n');
}

/** Pure: seconds -> `m:ss` (or `h:mm:ss`) label for frame markers. */
export function formatTimestamp(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
