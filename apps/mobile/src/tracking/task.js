import * as TaskManager from "expo-task-manager";

import { loadApiUrl } from "../lib/api";
import { LOCATION_TASK, reportFix } from "./tracker";

/**
 * The background location task.
 *
 * This must be defined at module scope and imported before React renders: when
 * the OS relaunches the app to deliver a location, it evaluates the bundle and
 * expects the task to already be registered. Defining it inside a component
 * would mean the task does not exist at the moment it is needed.
 *
 * It runs in its own JavaScript context with no React, no component state and
 * no in-memory session, which is why everything it needs comes from storage.
 */
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    // Nothing useful to do: the OS decides when to try again.
    return;
  }

  const locations = data?.locations;

  if (!locations?.length) {
    return;
  }

  // The cached base URL lives in module memory, which this context does not
  // share with the app's, so it has to be re-read on every wake-up.
  await loadApiUrl();

  // A batched delivery can carry several fixes. They are reported oldest-first
  // so geofence transitions replay in the order they actually happened.
  const ordered = [...locations].sort((a, b) => a.timestamp - b.timestamp);

  for (const location of ordered) {
    await reportFix(location);
  }
});
