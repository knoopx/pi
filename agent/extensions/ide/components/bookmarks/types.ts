import type { ListPickerItem } from "../../lib/list-picker";

export interface BookmarkEntry extends ListPickerItem {
  bookmarks: string[];
  changeId: string;
  description: string;
  author: string;
  
  displayNames: string[];
}
