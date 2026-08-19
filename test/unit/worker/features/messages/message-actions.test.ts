import { buildMessageActionPatch } from "@worker/features/messages/actions";
import { describe, expect, it } from "vitest";

describe("buildMessageActionPatch", () => {
  const inbound = { direction: "inbound" as const, isUnassigned: false };

  it("marks messages read and unread", () => {
    expect(buildMessageActionPatch("read", "now", inbound)).toEqual({ readAt: "now" });
    expect(buildMessageActionPatch("unread", "now", inbound)).toEqual({ readAt: null });
  });

  it("moves archive and trash folders", () => {
    expect(buildMessageActionPatch("archive", "now", inbound)).toMatchObject({
      folder: "archived",
      trashedAt: null
    });
    expect(buildMessageActionPatch("trash", "now", inbound)).toMatchObject({ folder: "trash" });
  });

  it("restores each message kind to its active folder", () => {
    expect(buildMessageActionPatch("restore", "now", inbound)).toEqual({
      archivedAt: null,
      folder: "inbox",
      trashedAt: null
    });
    expect(
      buildMessageActionPatch("restore", "now", {
        direction: "outbound",
        isUnassigned: false
      })
    ).toMatchObject({ folder: "sent" });
    expect(
      buildMessageActionPatch("restore", "now", {
        direction: "inbound",
        isUnassigned: true
      })
    ).toMatchObject({ folder: "catchall" });
  });
});
