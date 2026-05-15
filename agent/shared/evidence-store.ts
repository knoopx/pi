export interface EvidenceEntry {
  id: string;
  source: string;
  note: string;
  snippet: string;
}

const entries: EvidenceEntry[] = [];

export function resetSessionStore(): void {
  entries.length = 0;
}

export function getSessionStore(): EvidenceEntry[] {
  return entries;
}
