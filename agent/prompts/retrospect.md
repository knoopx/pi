---
description: Weekly work retrospective - review accomplishments across all projects
---

Conduct a weekly work retrospective for the past 7 days across ALL projects.

<workflow>
1. List all projects with recent activity
2. Review commits and changes per project
3. Summarize accomplishments by project
4. Identify blockers and incomplete work
5. Plan priorities for next week
</workflow>

<data-gathering>
```bash
# List all projects with recent activity
pi-list-projects --limit 50

# Session activity across all projects (last 7 days)

pi-session-events --days 7 --limit 100

# For each active project, check commits:

# jj log -R /path/to/project --no-graph -r 'mine() & committer_date(after:"7 days ago")' -T 'change_id.short() ++ " " ++ description.first_line() ++ "\n"' --ignore-working-copy

````
</data-gathering>

<per-project-analysis>
For each project with activity:
```bash
# Commits from the past week
jj log -R $PROJECT_PATH --no-graph -r 'mine() & committer_date(after:"7 days ago")' -T 'change_id.short() ++ " " ++ description.first_line() ++ "\n"' --ignore-working-copy

# Work in progress
jj log -R $PROJECT_PATH -r '@' --ignore-working-copy
````

</per-project-analysis>

<analysis>
**Accomplishments**
- Group by project first, then by feature/area
- Highlight completed and shipped work
- Note cross-project efforts

**In Progress**

- Incomplete features per project
- Open branches/changes
- Waiting on review/feedback

**Blockers**

- Technical blockers
- Dependencies on others
- Unclear requirements

**Learnings**

- Technical insights gained
- Process improvements discovered
  </analysis>

<output-format>
## Weekly Retrospective: [Date Range]

### ✅ Completed

#### [Project 1]

- [What was accomplished]
- [What was accomplished]

#### [Project 2]

- [What was accomplished]

### 🚧 In Progress

- **[Project]**: [Feature/task] - [status, next steps]

### 🚫 Blocked

- **[Project]**: [Item] - [blocker and resolution]

### 💡 Learnings

- [Technical or process insight]

### 🎯 Next Week

- [ ] [Project]: [Priority 1]
- [ ] [Project]: [Priority 2]

### 📊 Stats

| Project | Commits | Files Changed |
| ------- | ------- | ------------- |
| [name]  | [count] | [count]       |

</output-format>
