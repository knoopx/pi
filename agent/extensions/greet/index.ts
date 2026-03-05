import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const GREET_PATH = ".pi/GREET.md";

export default function createGreetingExtension(api: ExtensionAPI): void {
  api.on("session_start", async () => {
    try {
      const { access } = await import("fs/promises");
      await access(GREET_PATH);
      api.sendUserMessage("Read .pi/GREET.md");
    } catch {
      // GREET.md does not exist — no greeting
    }
  });
}
