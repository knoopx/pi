export interface SkillStats {
  totalSessions: number;
  totalSkillCalls: number;
  bySkill: Record<string, number>;
  bySession: Record<string, { count: number; skills: Record<string, number> }>;
  byDate: Record<string, { count: number; skills: Record<string, number> }>;
}
