import * as storage from "./storage";
import { sendLocationBatch, NetworkError } from "./api";

/**
 * The offline queue.
 *
 * GPS keeps working with no signal — the satellites do not care. What stops is
 * the upload. So a fix taken in a tunnel, on a plane or out of coverage is
 * written here and sent later, which is the whole reason the backend exposes a
 * batch endpoint.
 */

// A hard ceiling so a phone left offline for a week cannot fill its storage.
// The newest fixes are the ones worth keeping: they are what the owner is
// looking for when they open the map.
const MAX_QUEUED = 500;

// The backend caps a single batch, and a smaller chunk is also far likelier to
// survive a weak connection.
const BATCH_SIZE = 100;

export const enqueue = async (fix) => {
  const queue = await storage.readQueue();

  queue.push(fix);

  const trimmed =
    queue.length > MAX_QUEUED ? queue.slice(queue.length - MAX_QUEUED) : queue;

  await storage.writeQueue(trimmed);

  return trimmed.length;
};

export const queueSize = async () => (await storage.readQueue()).length;

export const clearQueue = () => storage.writeQueue([]);

/**
 * Uploads what is queued, oldest first.
 *
 * Ordering matters beyond tidiness: the server replays geofence transitions in
 * the order it receives them, so sending a backlog out of order would produce
 * arrivals and departures that never happened.
 *
 * Only the chunk that was actually accepted is dropped from the local queue.
 * If the network dies halfway, the rest is still there for next time, and the
 * server's unique (device, timestamp) index means a chunk sent twice is
 * deduplicated rather than doubled.
 */
export const flushQueue = async (deviceToken, deviceId) => {
  if (!deviceToken || !deviceId) {
    return { flushed: 0, remaining: await queueSize() };
  }

  let queue = await storage.readQueue();

  if (!queue.length) {
    return { flushed: 0, remaining: 0 };
  }

  queue = [...queue].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  let flushed = 0;

  while (queue.length) {
    const chunk = queue.slice(0, BATCH_SIZE);

    try {
      const result = await sendLocationBatch(deviceToken, deviceId, chunk);

      flushed += result.accepted ?? chunk.length;
      queue = queue.slice(chunk.length);

      // Persist after every chunk, so an interruption never replays work that
      // already landed.
      await storage.writeQueue(queue);
    } catch (error) {
      if (error instanceof NetworkError) {
        // Still offline. Keep everything and try again later.
        break;
      }

      // A 4xx means the server will never accept this chunk - a revoked token,
      // tracking switched off, or points too old to store. Retrying forever
      // would block every newer fix behind it, so it is dropped.
      if (error.status >= 400 && error.status < 500) {
        queue = queue.slice(chunk.length);
        await storage.writeQueue(queue);
        continue;
      }

      break;
    }
  }

  if (flushed > 0) {
    await storage.setLastSync(new Date().toISOString());
  }

  return { flushed, remaining: queue.length };
};
