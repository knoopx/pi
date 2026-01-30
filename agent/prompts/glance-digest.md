---
description: Fetch and digest content from Glance API into organized topics
---

Fetch and organize content from the Glance API service using the digest skill.

<workflow>
1. **Fetch** content from `https://glance.knoopx.net/api/pages/home/content/`
2. **Apply digest skill** to organize by topics
3. **Output** structured Markdown digest
</workflow>

<output_format>
Structure the digest with:
- Executive summary at top
- Topics as H2 sections
- Key points as bullet lists
- Links and references preserved
- Images included where relevant
</output_format>

<guidelines>
✅ DO:
- Group related items logically
- Use clear headings for each section
- Include summaries for each topic
- Preserve important links and media

❌ DON'T:
- Mix unrelated topics
- Drop important information
- Include superfluous content
- Force content into fixed categories
</guidelines>
