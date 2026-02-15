/**
 * Common SelectList styling options for extensions
 */

export const SELECT_LIST_STYLES = {
  selectedPrefix: (text: string) => `\x1b[32m>\x1b[0m ${text}`,
  selectedText: (text: string) => `\x1b[1m${text}\x1b[0m`,
  description: (text: string) => `\x1b[90m${text}\x1b[0m`,
  scrollInfo: (text: string) => `\x1b[90m${text}\x1b[0m`,
  noMatch: (text: string) => `\x1b[31m${text}\x1b[0m`,
};
