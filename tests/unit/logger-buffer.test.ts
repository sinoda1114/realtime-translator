import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearRecordedLogs,
  getRecordedLogs,
  logger,
  subscribeToRecordedLogs,
} from "@/lib/logger";

describe("logger recorded-log buffer", () => {
  beforeEach(() => {
    clearRecordedLogs();
    // The buffer mirrors what goes to console; silence it so test output
    // stays readable.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("records level, event, and fields", () => {
    logger.warn("some.event", { count: "3" });

    const logs = getRecordedLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: "warn",
      event: "some.event",
      fields: { count: "3" },
    });
  });

  test("keeps insertion order across levels", () => {
    logger.info("first", {});
    logger.error("second", {});

    expect(getRecordedLogs().map((entry) => entry.event)).toEqual(["first", "second"]);
  });

  // The panel only shows a short tail, and an unbounded buffer would grow for
  // the whole session — cap it so a long conversation can't balloon memory.
  test("caps the buffer, dropping the oldest entries", () => {
    for (let index = 0; index < 45; index += 1) {
      logger.info(`event-${index}`, {});
    }

    const logs = getRecordedLogs();
    expect(logs).toHaveLength(40);
    expect(logs[0].event).toBe("event-5");
    expect(logs[logs.length - 1].event).toBe("event-44");
  });

  test("notifies subscribers and stops after unsubscribing", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToRecordedLogs(listener);

    logger.info("one", {});
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    logger.info("two", {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("clearRecordedLogs empties the buffer", () => {
    logger.info("one", {});
    clearRecordedLogs();

    expect(getRecordedLogs()).toHaveLength(0);
  });
});
