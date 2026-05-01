---
description: Fetch followed project releases from Glance and generate a detailed changelog
---

Fetch the release feed from https://glance.knoopx.net/api/pages/home/content/ using transcribe.

From the Releases section, identify each unique project and its latest tag. Fetch full release notes for every project using gh-view-release or transcribe on the GitHub release page. For projects with multiple recent releases in the window, fetch at least the two most recent tags to capture incremental changes.

If a release body is empty from the API, fall back to transcribing the release page directly from GitHub. For beta releases that link out to external release notes (e.g., Home Assistant), follow and transcribe those linked pages too.

Output the changelog inline as Markdown — do not write a file unless explicitly asked. Structure it as:

1. One-paragraph summary per project covering all notable changes in the window.
2. If the user asks for detail, expand each project into a full structured changelog with version headings, bullet points, and contributor/PR references where available.

Group projects alphabetically. Show release dates next to version tags. Every version tag must be a Markdown link to the GitHub release page (e.g., `[b8994](https://github.com/ggml-org/llama.cpp/releases/tag/b8994)`). For incremental builds without notes (e.g., llama.cpp nightly-style builds), note them briefly rather than omitting them.
