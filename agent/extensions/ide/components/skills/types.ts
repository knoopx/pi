import type { ListPickerItem } from "../../lib/list-picker/picker";

export interface SkillInfo extends ListPickerItem {
  name: string;
  topic: string;
  description: string;
  skillType: "knowledge" | "protocol" | "tool" | "record";
  keywords: string[];
  path: string; // absolute file path
}
