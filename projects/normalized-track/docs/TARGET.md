# Render Normalized Track Extension Target

## Goal

Build an Ableton Live Extension named `Render Normalized Track` that renders an audio track to a new track while normalizing the rendered file so its highest sample peak reaches 0 dBFS.

## User Workflow

The user right-clicks an audio track in Live and chooses `Render Normalized Track`. The extension renders the source track's arrangement audio, normalizes that temporary render offline, imports the normalized file into the Live project, creates a new audio track, and places the normalized render at the source range start. The original track remains unchanged.

## Behavioral Contract

- Register a context menu action for `AudioTrack` during activation, using the SDK example pattern of direct activation-time menu registration bound to a stable command ID.
- Determine the render range from the selected track's arrangement clips.
- Render the selected track audio over that arrangement range without modifying the source track.
- Decode the rendered audio and find the highest absolute sample peak.
- Write a normalized WAV file where the highest absolute sample reaches 1.0 / 0 dBFS.
- Import the normalized WAV into the Live project with `resources.importIntoProject`.
- Create a new audio track and place the normalized render at the original start beat.
- Name the new track and clip from the source track.
- Log useful errors when the track has no arrangement clips, rendered audio is silent, import fails, or track/clip creation fails.
- Package the distributable `.ablx` under `C:\dev\live_ext\dist` with the version in the filename.

## Constraints

- Use the local Ableton Extensions SDK beta packages from `C:\dev\live_ext\sdk`.
- Keep the package shape minimal: `manifest.json` plus bundled `dist/extension.js`.
- Keep implementation non-interactive and context-menu driven.
- Use `docs/TARGET.md` as the durable project contract.

## Known SDK Limitations

The current SDK beta exposes `resources.renderPreFxAudio`, which renders pre-effects arrangement audio. It does not expose a post-FX track render. This means the normalized render captures source arrangement audio before existing track devices. Existing devices on the source track are not printed into the normalized render.

The SDK does not expose a direct audio peak API, so rendering is required for the extension to inspect samples and normalize the file.
