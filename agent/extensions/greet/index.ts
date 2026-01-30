import type {
  ExtensionAPI,
  SessionStartEvent,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";

/**
 * Pi Extension: Session Greeting
 * Automatically greets the user when a Pi session starts
 *
 * This extension listens for the session_start event and sends a friendly greeting
 * to the user, including a desktop notification and session information.
 */
export default function createGreetingExtension(api: ExtensionAPI): void {
  api.on(
    "session_start",
    async (_event: SessionStartEvent, _ctx: ExtensionContext) => {
      // Only trigger greeting if GREET.md exists
      try {
        const fs = await import("fs/promises");
        const greetPath = ".pi/GREET.md";

        // Check if file exists by attempting to access it
        try {
          await fs.access(greetPath);
          api.sendUserMessage("Read .pi/GREET.md");
        } catch {
          // File doesn't exist, silently skip
        }
      } catch (error) {
        // Silently fail - no greeting if file check fails
        console.log("Greeting extension: file check failed", error);
      }
    },
  );
}
