import * as ableton from "@ableton-extensions/sdk";

const COMMAND_ID = "consolidate-loop-selection.consolidate";
const MENU_TITLE = "Consolidate Selection To Loop";
const MIN_LOOP_LENGTH_BEATS = 0.25;

type TimeRange = {
  start: number;
  end: number;
  duration: number;
};

export function activate(activation: ableton.ActivationContext) {
  const context = ableton.initialize(activation, "1.0.0");

  context.ui.registerContextMenuAction(
    "AudioTrack.ArrangementSelection",
    MENU_TITLE,
    COMMAND_ID,
  );

  context.commands.registerCommand(COMMAND_ID, async (arg: unknown) => {
    try {
      const selection = arg as ableton.ArrangementSelection;
      const range = normalizeTimeSelection(selection);
      const track = getSingleSelectedAudioTrack(context, selection);

      await context.ui.withinProgressDialog(
        "Consolidating selection",
        { progress: 0 },
        async (update, signal) => {
          await update("Rendering selected range", 15);
          signal.throwIfAborted();

          const renderedPath = await context.resources.renderPreFxAudio(
            track,
            range.start,
            range.end,
          );

          await update("Importing rendered audio", 55);
          signal.throwIfAborted();

          const importedPath = await context.resources.importIntoProject(renderedPath);

          await update("Replacing selection with loop clip", 80);
          signal.throwIfAborted();

          await context.withinTransaction(() =>
            replaceRangeWithLoopedClip(track, range, importedPath),
          );

          await update("Done", 100);
        },
      );

      console.log(
        `Consolidated "${track.name}" range ${range.start}-${range.end} into a looped audio clip.`,
      );
    } catch (error) {
      console.error("Consolidate Selection To Loop failed:", error);
    }
  });
}

function normalizeTimeSelection(selection: ableton.ArrangementSelection): TimeRange {
  if (!Number.isFinite(selection.time_selection_start) || !Number.isFinite(selection.time_selection_end)) {
    throw new Error("Arrangement selection contains a non-finite time value.");
  }

  if (selection.time_selection_start === selection.time_selection_end) {
    throw new Error("Select a non-empty Arrangement time range before consolidating.");
  }

  const start = Math.min(selection.time_selection_start, selection.time_selection_end);
  const end = Math.max(selection.time_selection_start, selection.time_selection_end);
  const duration = end - start;

  if (duration < MIN_LOOP_LENGTH_BEATS) {
    throw new Error("Selection must be at least one 16th note long to create a looped clip.");
  }

  return { start, end, duration };
}

function getSingleSelectedAudioTrack(
  context: ableton.ExtensionContext<"1.0.0">,
  selection: ableton.ArrangementSelection,
): ableton.AudioTrack<"1.0.0"> {
  const tracks = selection.selected_lanes
    .map((handle) => context.getObjectFromHandle(handle, ableton.DataModelObject))
    .filter((object): object is ableton.AudioTrack<"1.0.0"> => object instanceof ableton.AudioTrack);

  if (tracks.length === 0) {
    throw new Error("Select a time range on one audio track.");
  }

  const uniqueTracks = [...new Map(tracks.map((track) => [track.handle.id.toString(), track])).values()];
  if (uniqueTracks.length !== 1) {
    throw new Error("Select a time range on exactly one audio track.");
  }

  const track = uniqueTracks[0];
  if (!track) {
    throw new Error("Select a time range on one audio track.");
  }

  return track;
}

async function replaceRangeWithLoopedClip(
  track: ableton.AudioTrack<"1.0.0">,
  range: TimeRange,
  importedPath: string,
) {
  await track.clearClipsInRange(range.start, range.end);

  await track.createAudioClip({
    filePath: importedPath,
    startTime: range.start,
    duration: range.duration,
    isWarped: true,
    loopSettings: {
      looping: true,
      startMarker: 0,
      endMarker: range.duration,
      loopStart: 0,
      loopEnd: range.duration,
    },
  });
}
