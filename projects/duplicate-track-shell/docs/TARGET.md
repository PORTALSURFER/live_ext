# Duplicate Clean Extension Target

## Goal

Build an Ableton Live Extension called `Duplicate Clean` that adds a track context menu action for duplicating a track without copying its clip content.

## User Workflow

The user right-clicks an audio or MIDI track in Live and chooses `Duplicate Clean`. The extension creates a duplicate track immediately after the source track and removes all clip content from the duplicate, leaving the copied track structure and settings intact.

## Behavioral Contract

- Register context menu actions for `AudioTrack` and `MidiTrack`.
- Use the host-facing context menu registration pattern from the SDK duplicate-track example: register menu actions during activation and bind them to the extension command ID.
- Duplicate the selected track through the SDK's `Song.duplicateTrack` API so Live preserves track name, devices, mixer state, routing/state that the host duplicate operation supports, and other track-level properties exposed by Live.
- Remove clip content only from the duplicated track, not the source track.
- Delete Session View clips from all duplicated clip slots.
- Delete Arrangement View clips from the duplicated track.
- Delete take-lane clips from duplicated take lanes when exposed by the SDK.
- Log failures to the Extension Host log with useful context.

## Constraints

- Use the local Ableton Extensions SDK beta packages from `C:\dev\live_ext\sdk`.
- Produce a distributable `.ablx` archive under `C:\dev\live_ext\dist`.
- Include the extension version in the distributable filename.
- Keep the implementation non-interactive and context-menu driven.

## Known SDK Limitations

The SDK beta currently exposes clip color but does not expose a track color property in the public TypeScript declarations. Track color preservation is therefore delegated to Live's native track duplication behavior rather than manually copied by extension code.
