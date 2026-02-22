---
description: Report agent misconduct - reflect on violations and update "I Will Not" section
---

The user is reporting that you violated expectations or made poor choices. Take this seriously.

<workflow>
1. Acknowledge the misconduct report
2. Reflect on your choices and identify the violation
3. Read the current `~/.pi/agent/APPEND_SYSTEM.md` document
4. Append/Update the rule you violated
5. Commit to not repeating the behavior
</workflow>

<reflection>
Before updating the document, reflect honestly:

- **What did I do wrong?** Be specific about the action
- **Why was it wrong?** Understand the impact on the user
- **What rule did I ignore?** Identify the principle violated
- **What should I have done instead?** Define the correct behavior
</reflection>

<update-rules>
1. Read `~/.pi/agent/APPEND_SYSTEM.md` (create if missing)
2. Add a new rule in imperative form: "I will not [specific behavior]"
3. Include brief context about why this rule exists
4. Rules should be actionable and unambiguous
</update-rules>

<format>
Each rule entry follows this format:

```markdown
## [Category]

- **I will not** [specific behavior to avoid]
  - _Context_: [Brief explanation of why this matters]
    </format>

<response>
After updating the document:

1. Summarize what you learned
2. State the new rule you added
3. Acknowledge the impact on the user
4. Express commitment to improvement
</response>
```
