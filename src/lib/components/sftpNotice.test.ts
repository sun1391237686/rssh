import { describe, expect, it } from "vitest";
import { shouldClearQueuedNotice } from "./sftpNotice";

describe("sftp notice helper", () => {
  it("clears queued notices once all transfers finish", () => {
    expect(shouldClearQueuedNotice("queued", 0)).toBe(true);
    expect(shouldClearQueuedNotice("queued", 2)).toBe(false);
    expect(shouldClearQueuedNotice("folder_empty", 0)).toBe(false);
    expect(shouldClearQueuedNotice(null, 0)).toBe(false);
  });
});