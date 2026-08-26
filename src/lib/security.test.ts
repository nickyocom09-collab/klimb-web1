import { describe, expect, it } from "vitest";
import { passwordValidationError } from "./authSecurity";
import {
  imageContentError,
  imageUploadError,
  safeImageExtension,
} from "./uploadSecurity";

function fakeFile(type: string, size: number, name = "untrusted.exe") {
  return { type, size, name } as File;
}

describe("account and upload security", () => {
  it("requires an 8-character password", () => {
    expect(passwordValidationError("short1")).toContain("8");
    expect(passwordValidationError("a-long-passphrase")).toBeNull();
  });

  it("rejects unsupported and oversized image uploads", () => {
    expect(imageUploadError(fakeFile("text/html", 100))).toContain("JPEG");
    expect(imageUploadError(fakeFile("image/jpeg", 13 * 1024 * 1024))).toContain(
      "too large",
    );
  });

  it("derives the stored extension from MIME, never the filename", () => {
    expect(safeImageExtension(fakeFile("image/jpeg", 100))).toBe("jpg");
    expect(safeImageExtension(fakeFile("image/webp", 100))).toBe("webp");
  });

  it("rejects a spoofed image MIME when the file bytes are HTML", async () => {
    const disguised = new File(["<svg onload=alert(1)></svg>"], "photo.jpg", {
      type: "image/jpeg",
    });
    expect(await imageContentError(disguised)).toContain("valid JPEG");
  });

  it("accepts a JPEG signature", async () => {
    const jpeg = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])],
      "photo.jpg",
      { type: "image/jpeg" },
    );
    expect(await imageContentError(jpeg)).toBeNull();
  });
});
