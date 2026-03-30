#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

const PI_SESSIONS_ROOT = path.join(os.homedir(), ".pi", "agent", "sessions");
// Gap threshold: sessions within 30 minutes are considered continuous work
const GAP_THRESHOLD_MS = 30 * 60 * 1000;

interface SessionLine {
  type: "session";
  timestamp: string;
  cwd: string;
}

interface MessageLine {
  type: "message";
  timestamp: string;
  message: {
    role: "user" | "assistant";
    timestamp?: number;
  };
}

interface SessionEntry {
  project: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
}

interface WorkBlock {
  startTime: Date;
  endTime: Date;
  durationMs: number;
  projects: Set<string>;
}

interface DayRecord {
  date: string;
  dayStart: Date;
  dayEnd: Date;
  workBlocks: WorkBlock[];
  totalEffectiveMs: number;
  projects: Set<string>;
}

async function main() {
  const sessionDirs = await findWorkSessionDirs();

  if (sessionDirs.length === 0) {
    console.log("No work session directories found.");
    return;
  }

  const allSessions: SessionEntry[] = [];

  for (const dir of sessionDirs) {
    const sessions = await processSessionDir(dir);
    allSessions.push(...sessions);
  }

  if (allSessions.length === 0) {
    console.log("No sessions with data found.");
    return;
  }

  // Sort by start time
  allSessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Group by date and merge into work blocks
  const dailyRecords = buildDailyRecords(allSessions);

  // Print compliance report
  printTimesheet(dailyRecords);
}

async function findWorkSessionDirs(): Promise<string[]> {
  const entries = await fs.readdir(PI_SESSIONS_ROOT, { withFileTypes: true });
  const workDirs: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.includes("slng")) {
      workDirs.push(path.join(PI_SESSIONS_ROOT, entry.name));
    }
  }

  return workDirs.sort();
}

async function processSessionDir(dir: string): Promise<SessionEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const sessions: SessionEntry[] = [];

  const jsonlFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
    .map((e) => path.join(dir, e.name));

  for (const file of jsonlFiles) {
    const session = await parseSessionFile(file, dir);
    if (session) {
      sessions.push(session);
    }
  }

  return sessions;
}

async function parseSessionFile(
  filePath: string,
  dir: string,
): Promise<SessionEntry | null> {
  const fileStream = await fs.open(filePath, "r");
  const rl = readline.createInterface({
    input: fileStream.createReadStream(),
    crlfDelay: Infinity,
  });

  let firstTimestamp: Date | null = null;
  let lastTimestamp: Date | null = null;

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line) as SessionLine | MessageLine;

      if (parsed.type === "session") {
        firstTimestamp = new Date(parsed.timestamp);
      } else if (parsed.type === "message") {
        const ts = new Date(parsed.timestamp);
        if (!firstTimestamp || ts < firstTimestamp) {
          firstTimestamp = ts;
        }
        if (!lastTimestamp || ts > lastTimestamp) {
          lastTimestamp = ts;
        }
      }
    } catch {
      // Skip invalid lines
    }
  }

  await fileStream.close();

  if (!firstTimestamp || !lastTimestamp) {
    return null;
  }

  const project = dir;
  const durationMs = lastTimestamp.getTime() - firstTimestamp.getTime();

  return {
    project,
    startTime: firstTimestamp,
    endTime: lastTimestamp,
    durationMs,
  };
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalMidnight(date: Date): Date {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

function buildDailyRecords(sessions: SessionEntry[]): Map<string, DayRecord> {
  const byDate = new Map<string, SessionEntry[]>();

  // Group sessions by date (using local date), splitting sessions that span midnight
  for (const session of sessions) {
    const startDate = getLocalDateString(session.startTime);
    const endDate = getLocalDateString(session.endTime);

    if (startDate === endDate) {
      // Session is within a single day
      if (!byDate.has(startDate)) {
        byDate.set(startDate, []);
      }
      byDate.get(startDate)!.push(session);
    } else {
      // Session spans midnight - split it at local midnight
      const midnightLocal = getLocalMidnight(session.endTime);

      // Part before midnight (ends at 23:59:59 of start day)
      const endOfStartDay = new Date(midnightLocal.getTime() - 1000);
      const beforeMidnight: SessionEntry = {
        project: session.project,
        startTime: session.startTime,
        endTime: endOfStartDay,
        durationMs: endOfStartDay.getTime() - session.startTime.getTime(),
      };

      // Part after midnight (starts at 00:00:00 of end day)
      const afterMidnight: SessionEntry = {
        project: session.project,
        startTime: midnightLocal,
        endTime: session.endTime,
        durationMs: session.endTime.getTime() - midnightLocal.getTime(),
      };

      if (beforeMidnight.durationMs > 0) {
        if (!byDate.has(startDate)) {
          byDate.set(startDate, []);
        }
        byDate.get(startDate)!.push(beforeMidnight);
      }

      if (afterMidnight.durationMs > 0) {
        if (!byDate.has(endDate)) {
          byDate.set(endDate, []);
        }
        byDate.get(endDate)!.push(afterMidnight);
      }
    }
  }

  const dailyRecords = new Map<string, DayRecord>();

  for (const [date, daySessions] of byDate) {
    // Sort by start time
    daySessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Merge overlapping/adjacent sessions into work blocks
    const workBlocks = mergeIntoWorkBlocks(daySessions);

    const dayStart = workBlocks[0].startTime;
    const dayEnd = workBlocks.reduce(
      (max, b) => (b.endTime > max ? b.endTime : max),
      workBlocks[0].endTime,
    );

    const totalEffectiveMs = workBlocks.reduce(
      (sum, b) => sum + b.durationMs,
      0,
    );

    const projects = new Set<string>();
    for (const block of workBlocks) {
      for (const p of block.projects) {
        projects.add(p);
      }
    }

    dailyRecords.set(date, {
      date,
      dayStart,
      dayEnd,
      workBlocks,
      totalEffectiveMs,
      projects,
    });
  }

  return dailyRecords;
}

// Extended gap for short sessions: merge if gap < 2 hours
const EXTENDED_GAP_MS = 2 * 60 * 60 * 1000;

function mergeIntoWorkBlocks(sessions: SessionEntry[]): WorkBlock[] {
  if (sessions.length === 0) return [];

  const blocks: WorkBlock[] = [];
  let current: WorkBlock = {
    startTime: sessions[0].startTime,
    endTime: sessions[0].endTime,
    durationMs: 0,
    projects: new Set([sessions[0].project]),
  };

  for (let i = 1; i < sessions.length; i++) {
    const session = sessions[i];
    const gap = session.startTime.getTime() - current.endTime.getTime();
    const currentDuration =
      current.endTime.getTime() - current.startTime.getTime();

    // Merge if: gap <= 30 min, OR current block is short and gap < 2 hours
    const shouldMerge =
      gap <= GAP_THRESHOLD_MS ||
      (currentDuration < GAP_THRESHOLD_MS && gap < EXTENDED_GAP_MS);

    if (shouldMerge) {
      if (session.endTime > current.endTime) {
        current.endTime = session.endTime;
      }
      current.projects.add(session.project);
    } else {
      current.durationMs =
        current.endTime.getTime() - current.startTime.getTime();
      blocks.push(current);
      current = {
        startTime: session.startTime,
        endTime: session.endTime,
        durationMs: 0,
        projects: new Set([session.project]),
      };
    }
  }

  current.durationMs = current.endTime.getTime() - current.startTime.getTime();
  blocks.push(current);

  return blocks;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatDurationPair(effectiveMs: number, scheduleMs: number): string {
  const effective = formatDuration(effectiveMs);
  const schedule = formatDuration(scheduleMs);
  return effective === schedule ? effective : `${effective} ─ ${schedule}`;
}

interface WeekRecord {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  days: DayRecord[];
  totalMs: number;
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: d.getFullYear(), week };
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupByWeek(dailyRecords: Map<string, DayRecord>): WeekRecord[] {
  const weekMap = new Map<string, WeekRecord>();

  for (const [dateStr, record] of dailyRecords) {
    const date = new Date(dateStr);
    const { year, week } = getISOWeek(date);
    const weekKey = `${year}-W${week.toString().padStart(2, "0")}`;

    if (!weekMap.has(weekKey)) {
      const monday = getMonday(date);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      weekMap.set(weekKey, {
        weekKey,
        weekStart: getLocalDateString(monday),
        weekEnd: getLocalDateString(sunday),
        days: [],
        totalMs: 0,
      });
    }

    const weekRecord = weekMap.get(weekKey)!;
    weekRecord.days.push(record);
    weekRecord.totalMs += record.totalEffectiveMs;
  }

  const weeks = [...weekMap.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );

  for (const week of weeks) {
    week.days.sort((a, b) => a.date.localeCompare(b.date));
  }

  return weeks;
}

function printTimesheet(dailyRecords: Map<string, DayRecord>): void {
  const weeks = groupByWeek(dailyRecords);
  let grandTotalMs = 0;
  let totalDays = 0;

  for (const week of weeks) {
    // Calculate week totals
    const weekEffectiveMs = week.days.reduce(
      (sum, d) => sum + d.totalEffectiveMs,
      0,
    );
    const weekScheduleMs = week.days.reduce(
      (sum, d) => sum + d.dayEnd.getTime() - d.dayStart.getTime(),
      0,
    );
    grandTotalMs += weekEffectiveMs;
    totalDays += week.days.length;

    const weekDurations = formatDurationPair(weekEffectiveMs, weekScheduleMs);
    console.log("");
    console.log(
      `📅 ${week.weekKey} (${week.weekStart} → ${week.weekEnd}) │ ${weekDurations}`,
    );
    console.log("─".repeat(70));

    for (const record of week.days) {
      if (record.workBlocks.length === 0) continue;

      const spans = record.workBlocks
        .map((b) => `${formatTime(b.startTime)}─${formatTime(b.endTime)}`)
        .join(" · ");
      const scheduleMs = record.dayEnd.getTime() - record.dayStart.getTime();
      const durations = formatDurationPair(record.totalEffectiveMs, scheduleMs);

      console.log(`   ${record.date}  ${spans} | ${durations}`);
    }
  }

  console.log("");
  console.log("━".repeat(70));
  console.log("📊 SUMMARY");
  console.log("─".repeat(70));
  console.log(`   Weeks:                 ${weeks.length}`);
  console.log(`   Days worked:           ${totalDays}`);
  console.log(`   Total effective hours: ${formatDuration(grandTotalMs)}`);
  console.log("━".repeat(70));
}

await main();
