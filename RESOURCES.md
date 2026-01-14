# Pi Coding Agent – Resource Index

Curated links and resources for the Pi coding agent (the terminal-based coding agent behind pi.ai / shittycodingagent.ai).

---

## Official & Core Resources

- **Project / Mono‑repo** (source, issues, releases)
  - GitHub: https://github.com/badlogic/pi-mono
  - Package: `packages/coding-agent` (`@mariozechner/pi-coding-agent`)

- **NPM Package**
  - https://www.npmjs.com/package/@mariozechner/pi-coding-agent

- **Website / Landing Page**
  - https://shittycodingagent.ai

- **Blog Post – Design & Philosophy**
  - _What I learned building an opinionated and minimal coding agent_
    https://mariozechner.at/posts/2025-11-30-pi-coding-agent/

- **Blog Post – Year in Review 2025**
  - _Year in Review 2025_
    https://mariozechner.at/posts/2025-12-22-year-in-review-2025/

- **Documentation Entry Points (in this repo / package)**
  - Main README (feature overview, install, usage, config, philosophy)
    `/node_modules/@mariozechner/pi-coding-agent/README.md`
  - Additional docs: `/node_modules/@mariozechner/pi-coding-agent/docs/`
    - `session.md` – session format & branching
    - `compaction.md` – context compaction
    - `theme.md` – custom themes
    - `skills.md` – Agent Skills integration
    - `extensions.md` – extensions, tools, commands, events
    - `tui.md` – custom TUI components
    - `sdk.md` – programmatic SDK
    - `rpc.md` – RPC/headless protocol
  - Examples: `/node_modules/@mariozechner/pi-coding-agent/examples/`
    - `extensions/` – custom tools, commands, UI, sub‑agents, todos, etc.
    - `skills/` – example skills
    - `sdk/` – SDK usage examples

---

## Community & Integrations

- **Discord Community**
  - Badge + invite are in the main README
    (current invite: https://discord.com/invite/nKXTsAcmbT)

- **Awesome Pi Agent List**
  - `qualisero/awesome-pi-agent` – curated list of add-ons, hooks, tools, skills, and resources for the Pi coding agent
    https://github.com/qualisero/awesome-pi-agent

- **Emacs Frontend**
  - `dnouri/pi-coding-agent` – Emacs UI for the Pi coding agent
    https://github.com/dnouri/pi-coding-agent
  - Releases / changelog: https://github.com/dnouri/pi-coding-agent/releases

- **Official Skills Collection**
  - `badlogic/pi-skills` – official/curated skills for the Pi coding agent (also compatible with Claude Code and Codex CLI)
    https://github.com/badlogic/pi-skills

- **Ralph Agent Harness**
  - `ralph` – CLI agent harness that can run Pi as one of multiple coding agents
    https://docs.rs/crate/ralph/0.1.5

- **Community Extensions & Configurations**
  - `hjanuschka/shitty-extensions` – Collection of community extensions (cost-tracker, handoff, memory-mode, etc.)
    https://github.com/hjanuschka/shitty-extensions
  - `carmandale/agent-config` – Unified configuration for AI coding agents (Pi, Claude Code, Codex, OpenCode)
    https://github.com/carmandale/agent-config
  - `qualisero/rhubarb-pi` – Small extensions (background-notify, session-emoji, session-color, safe-git)
    https://github.com/qualisero/rhubarb-pi
  - `lsj5031/ralph-pi-extension` – Autonomous AI agent for pi that works through PRDs iteratively
    https://github.com/lsj5031/ralph-pi-extension
  - `Dwsy/knowledge-builder-extension` – Autonomous knowledge base generation using natural language and Ralph Loop technique for Pi Agent
    https://github.com/Dwsy/knowledge-builder-extension
  - `lsj5031/pi-notification-extension` – Notifications (Telegram + bell) extension for @mariozechner/pi-coding-agent
    https://github.com/lsj5031/pi-notification-extension
  - `ferologics/pi-extensions` – Custom pi-coding-agent extensions
    https://github.com/ferologics/pi-extensions
  - `nicobailon/pi-powerline-footer` – Powerline-style status bar extension for pi coding agent
    https://github.com/nicobailon/pi-powerline-footer
  - `galz10/pickle-rick-extension` – Gemini CLI extension for iterative development loops
    https://github.com/galz10/pickle-rick-extension
  - `dannote/dot-pi` – Extensions, skills, and rules for Pi coding agent
    https://github.com/dannote/dot-pi
  - `LarsEckart/dotfiles` – Pi agent configuration
    https://github.com/LarsEckart/dotfiles
  - `michalvavra/agents` – Extensions and configuration examples (filter-output, security)
    https://github.com/michalvavra/agents
  - `RebelPotato/agent-config` – my .pi/agent configuration
    https://github.com/RebelPotato/agent-config
  - `pjtf93/pi-extensions` – Custom extensions for pi coding agent
    https://github.com/pjtf93/pi-extensions

---

## Tutorials, Demos & Talks

- **Overview Talk – pi Coding Agent**
  - _pi – a radically minimal, opinionated multi-model coding agent_ (YouTube)
    https://www.youtube.com/watch?v=4p2uQ4FQtis

- **Building a Game with Pi**
  - _Building a Computer Game from Scratch With Opus and PI_ (YouTube)
    https://www.youtube.com/watch?v=ANQ1IYsFM2s

- **Hacking pi Video**
  - _Hacking pi, the little coding agent that could, using pi_ (YouTube)
    https://www.youtube.com/watch?v=dWlhu0aWCb8

- **Writing Year in Review Video**
  - _Writing "Year in Review"_ (YouTube)
    https://www.youtube.com/watch?v=U45RZNVOGwM

- **Design / Philosophy Deep‑Dive**
  - Blog post (also linked above) explaining minimal tools, no‑MCP, no sub‑agents, etc.:
    https://mariozechner.at/posts/2025-11-30-pi-coding-agent/