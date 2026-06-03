# Consolidate Loop Selection Target

## Product Goal

Create a small Ableton Live Extension that turns an Arrangement time selection on an audio track into a consolidated loop clip.

## User Workflow

1. The user selects a time range in Arrangement view on an audio track.
2. The user opens the context menu on the Arrangement selection.
3. The user runs "Consolidate Selection To Loop".
4. The extension renders the selected range of that audio track.
5. The extension clears the original clips/content in the selected range.
6. The extension creates one new audio clip at the original selection start.
7. The new clip spans the selected range and has looping enabled.

## Functional Contract

- Operates only on `AudioTrack.ArrangementSelection`.
- Requires a non-empty Arrangement time selection.
- Requires exactly one selected audio lane for the first version.
- Uses `resources.renderPreFxAudio(track, start, end)` to create the consolidated audio.
- Uses `resources.importIntoProject(renderedPath)` before creating the new audio clip.
- Uses `track.clearClipsInRange(start, end)` before placing the consolidated clip.
- Creates the replacement clip with:
  - `startTime = selection start`
  - `duration = selection end - selection start`
  - `isWarped = true`
  - loop markers covering the rendered selection duration

## SDK Limitations

The Ableton Extensions SDK `1.0.0-beta.0` does not expose Live's native Split or Consolidate commands. This extension implements the requested workflow through SDK-native rendering, clearing, importing, and clip creation.

MIDI support is intentionally out of scope for the first version because MIDI note time semantics across cropped Arrangement clips are not documented enough to implement durable splitting/consolidation behavior.

## Non-Goals

- No Session View support.
- No multi-track batch consolidation in the first version.
- No MIDI support in the first version.
- No private Live API calls or keyboard automation.
- No device/post-FX rendering; this uses pre-FX audio by SDK design.

