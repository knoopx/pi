import type { ListPickerItem } from "../../lib/list-picker";
import type { OpLogEntry } from "../../jj/oplog";

export interface OpLogItem extends ListPickerItem, OpLogEntry {
  isCurrent: boolean;
}
