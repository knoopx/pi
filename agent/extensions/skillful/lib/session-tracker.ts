export class SessionTracker {
  private read = new Set<string>();

  markRead(name: string): void {
    this.read.add(name.toLowerCase());
  }

  isRead(skill: { name: string }): boolean {
    return this.read.has(skill.name.toLowerCase());
  }

  isSkillRead(path: string): string | null {
    if (!path.includes("SKILL.md")) return null;
    const parts = path.split("/");
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === "SKILL.md" && i > 0) {
        return parts[i - 1];
      }
    }
    return null;
  }

  reset(): void {
    this.read.clear();
  }
}

// Singleton — shared across ALL extensions in the same process.
export const tracker = new SessionTracker();
