import * as ableton from "@ableton-extensions/sdk";

const COMMAND_ID = "duplicate-clean.duplicate";
const MENU_TITLE = "Duplicate Clean";

export function activate(activation: ableton.ActivationContext) {
  const context = ableton.initialize(activation, "1.0.0");

  context.ui.registerContextMenuAction("AudioTrack", MENU_TITLE, COMMAND_ID);
  context.ui.registerContextMenuAction("MidiTrack", MENU_TITLE, COMMAND_ID);

  context.commands.registerCommand(COMMAND_ID, async (arg: unknown) => {
    try {
      const sourceTrack = context.getObjectFromHandle(
        arg as ableton.Handle,
        ableton.Track,
      );

      if (!(sourceTrack instanceof ableton.AudioTrack || sourceTrack instanceof ableton.MidiTrack)) {
        console.warn("Duplicate Clean was invoked for a non-audio/MIDI track.");
        return;
      }

      const duplicate = await context.application.song.duplicateTrack(sourceTrack);

      await context.withinTransaction(() =>
        Promise.all([
          ...duplicate.arrangementClips.map((clip) => duplicate.deleteClip(clip)),
          ...duplicate.clipSlots
            .filter((slot) => slot.clip !== null)
            .map((slot) => slot.deleteClip()),
          ...duplicate.takeLanes.flatMap((takeLane) =>
            takeLane.clips.map((clip) => duplicate.deleteClip(clip)),
          ),
        ]),
      );

      console.log(`Created empty duplicate of track "${sourceTrack.name}".`);
    } catch (error) {
      console.error("Failed to duplicate track cleanly:", error);
    }
  });
}
