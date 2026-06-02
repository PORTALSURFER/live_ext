import * as ableton from "@ableton-extensions/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import decodeAudio from "audio-decode";

const COMMAND_ID = "render-normalized-track.render";
const MENU_TITLE = "Render Normalized Track";
const TARGET_PEAK = 1.0;

type DecodedAudio = {
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  readonly length: number;
  getChannelData(channel: number): Float32Array;
};

export function activate(activation: ableton.ActivationContext) {
  const context = ableton.initialize(activation, "1.0.0");

  context.ui.registerContextMenuAction("AudioTrack", MENU_TITLE, COMMAND_ID);

  context.commands.registerCommand(COMMAND_ID, async (arg: unknown) => {
    try {
      const sourceTrack = context.getObjectFromHandle(
        arg as ableton.Handle,
        ableton.AudioTrack,
      );

      await context.ui.withinProgressDialog(
        "Rendering normalized track",
        { progress: 0 },
        async (update, signal) => {
          const range = getArrangementClipRange(sourceTrack);

          if (!range) {
            console.warn(`Track "${sourceTrack.name}" has no arrangement clips to render.`);
            return;
          }

          await update("Rendering source audio", 20);
          signal.throwIfAborted();

          const renderedPath = await context.resources.renderPreFxAudio(
            sourceTrack,
            range.start,
            range.end,
          );

          await update("Normalizing render", 55);
          signal.throwIfAborted();

          const normalizedPath = await normalizeRenderedAudio(renderedPath);

          if (!normalizedPath) {
            console.warn(`Track "${sourceTrack.name}" rendered silence; no normalized track was created.`);
            return;
          }

          await update("Importing audio", 75);
          signal.throwIfAborted();

          const importedPath = await context.resources.importIntoProject(normalizedPath);

          await update("Creating track", 90);
          signal.throwIfAborted();

          const renderTrack = await context.application.song.createAudioTrack();
          renderTrack.name = `${sourceTrack.name} (Normalized Render)`;

          const clip = await renderTrack.createAudioClip({
            filePath: importedPath,
            startTime: range.start,
            duration: range.end - range.start,
            isWarped: false
          });
          clip.name = `${sourceTrack.name} normalized`;

          await update("Done", 100);
          console.log(`Rendered normalized copy of "${sourceTrack.name}" to "${renderTrack.name}".`);
        },
      );
    } catch (error) {
      console.error("Failed to render normalized track:", error);
    }
  });
}

function getArrangementClipRange(track: ableton.AudioTrack<"1.0.0">):
  | { start: number; end: number }
  | null {
  const clips = track.arrangementClips;

  if (clips.length === 0) {
    return null;
  }

  return clips.reduce(
    (range, clip) => ({
      start: Math.min(range.start, clip.startTime),
      end: Math.max(range.end, clip.endTime)
    }),
    { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY },
  );
}

async function normalizeRenderedAudio(renderedPath: string): Promise<string | null> {
  const decoded = await decodeAudio(await fs.readFile(renderedPath)) as DecodedAudio;
  const peak = readPeakAmplitude(decoded);

  if (peak <= 0) {
    return null;
  }

  const gain = TARGET_PEAK / peak;
  const outputDirectory = path.dirname(renderedPath);
  const outputPath = path.join(outputDirectory, `normalized-${Date.now()}.wav`);

  await fs.writeFile(outputPath, encodeFloat32Wav(decoded, gain));

  return outputPath;
}

function readPeakAmplitude(decoded: DecodedAudio): number {
  let peak = 0;

  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const samples = decoded.getChannelData(channel);

    for (let i = 0; i < samples.length; i += 1) {
      const amplitude = Math.abs(samples[i] ?? 0);

      if (amplitude > peak) {
        peak = amplitude;
      }
    }
  }

  return peak;
}

function encodeFloat32Wav(decoded: DecodedAudio, gain: number): Buffer {
  const bytesPerSample = 4;
  const channelCount = decoded.numberOfChannels;
  const frameCount = decoded.length;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(3, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(decoded.sampleRate, 24);
  buffer.writeUInt32LE(decoded.sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(32, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const channelData = Array.from(
    { length: channelCount },
    (_, channel) => decoded.getChannelData(channel),
  );
  let offset = 44;

  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = clamp((channelData[channel]?.[frame] ?? 0) * gain, -1, 1);
      buffer.writeFloatLE(sample, offset);
      offset += bytesPerSample;
    }
  }

  return buffer;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
