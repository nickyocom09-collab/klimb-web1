import { describe, expect, it, vi } from "vitest";
import { fileFromPickedVideo } from "./videoPicker";

describe("fileFromPickedVideo", () => {
  it("accepts a readable Capacitor media response even when WebKit reports ok false", async () => {
    const videoBytes = new Blob([new Uint8Array([0, 1, 2, 3])], {
      type: "video/quicktime",
    });
    const fetchFile = vi.fn(async () => ({
      ok: false,
      status: 0,
      blob: async () => videoBytes,
    })) as unknown as typeof fetch;

    const file = await fileFromPickedVideo(
      {
        uri: "file:///tmp/selected.mov",
        webPath: "capacitor://localhost/_capacitor_file_/tmp/selected.mov",
        name: "selected.mov",
        mime: "video/quicktime",
      },
      fetchFile,
    );

    expect(fetchFile).toHaveBeenCalledWith(
      "capacitor://localhost/_capacitor_file_/tmp/selected.mov",
    );
    expect(file).not.toBeNull();
    expect(file?.name).toBe("selected.mov");
    expect(file?.type).toBe("video/quicktime");
    expect(file?.size).toBe(videoBytes.size);
  });

  it("rejects an empty native video payload", async () => {
    const fetchFile = vi.fn(async () => ({
      ok: false,
      status: 0,
      blob: async () => new Blob([], { type: "video/quicktime" }),
    })) as unknown as typeof fetch;

    await expect(
      fileFromPickedVideo(
        {
          webPath: "capacitor://localhost/_capacitor_file_/tmp/empty.mov",
          name: "empty.mov",
        },
        fetchFile,
      ),
    ).rejects.toThrow("Could not read the selected video.");
  });

  it("treats a canceled native selection as no file", async () => {
    const fetchFile = vi.fn() as unknown as typeof fetch;

    await expect(fileFromPickedVideo({}, fetchFile)).resolves.toBeNull();
    expect(fetchFile).not.toHaveBeenCalled();
  });
});
