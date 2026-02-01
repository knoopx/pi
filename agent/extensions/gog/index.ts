// Type definitions for gog command outputs
interface GmailMessage {
  id: string;
  date: string;
  from: string;
  subject: string;
  labels: string[];
  messageCount?: number;
}

interface CalendarEvent {
  eventType?: string;
  summary?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
  reminders?: {
    overrides?: Array<{
      method?: string;
      minutes?: number;
    }>;
  };
  visibility?: string;
  transparency?: string;
  organizer?: {
    displayName?: string;
  };
}

interface CalendarCalendar {
  accessRole?: string;
  backgroundColor?: string;
  colorId?: string;
  conferenceProperties?: {
    allowedConferenceSolutionTypes?: string[];
  };
  defaultReminders?: Array<{
    method?: string;
    minutes?: number;
  }>;
  etag?: string;
  foregroundColor?: string;
  id: string;
  kind?: string;
  selected?: boolean;
  summary?: string;
  summaryOverride?: string;
  timeZone?: string;
  primary?: boolean;
  dataOwner?: string;
  notificationSettings?: {
    notifications?: Array<{
      method?: string;
      type?: string;
    }>;
  };
}

interface Contact {
  resource?: string;
  name?: string;
  phone?: string;
  email?: string;
}

interface KeepNote {
  id: string;
  title?: string;
  text?: string;
  tags?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  creationTime?: string;
  updateTime?: string;
}

interface Task {
  id: string;
  title?: string;
  notes?: string;
  dueDate?: string;
  completedDate?: string;
  status?: string;
  listId?: string;
}

interface TaskList {
  id: string;
  title?: string;
}