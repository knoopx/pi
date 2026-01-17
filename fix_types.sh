#!/bin/bash

EXTENSIONS="ast-grep browser cheatsh codemap exa-search github handoff init jujutsu lsp markitdown nix npm pip ralph-loop reverse-history-search sessions toon"

for ext in $EXTENSIONS; do
  file="agent/extensions/$ext/index.ts"
  if [ -f "$file" ]; then
    echo "Processing $ext"
    
    # Add import if not present
    if ! grep -q "OnUpdate, ToolContext" "$file"; then
      sed -i 's/import type { ExtensionAPI } from "@mariozechner\/pi-coding-agent";/import type { ExtensionAPI, OnUpdate, ToolContext } from "@mariozechner\/pi-coding-agent";/' "$file"
    fi
    
    # Replace execute signatures - various patterns
    # Pattern 1: async execute(toolCallId, params, onUpdate, ctx, signal)
    sed -i 's/async execute(toolCallId, params, onUpdate, ctx, signal)/async execute(toolCallId: string, params: any, onUpdate: OnUpdate, ctx: ToolContext, signal: AbortSignal)/g' "$file"
    
    # Pattern 2: async execute(_toolCallId, params, _onUpdate, _ctx, signal)
    sed -i 's/async execute(_toolCallId, params, _onUpdate, _ctx, signal)/async execute(_toolCallId: string, params: any, _onUpdate: OnUpdate, _ctx: ToolContext, signal: AbortSignal)/g' "$file"
    
    # Pattern 3: async execute(_toolCallId, params, onUpdate, _ctx, signal)
    sed -i 's/async execute(_toolCallId, params, onUpdate, _ctx, signal)/async execute(_toolCallId: string, params: any, onUpdate: OnUpdate, _ctx: ToolContext, signal: AbortSignal)/g' "$file"
    
    # Pattern 4: async execute(toolCallId, params, onUpdate, ctx, signal?)
    sed -i 's/async execute(toolCallId, params, onUpdate, ctx, signal?)/async execute(toolCallId: string, params: any, onUpdate: OnUpdate, ctx: ToolContext, signal?: AbortSignal)/g' "$file"
    
    # Pattern 5: async execute(_toolCallId, _params, _onUpdate, _ctx, _signal)
    sed -i 's/async execute(_toolCallId, _params, _onUpdate, _ctx, _signal)/async execute(_toolCallId: string, _params: any, _onUpdate: OnUpdate, _ctx: ToolContext, _signal: AbortSignal)/g' "$file"
    
    # Add more patterns as needed
    sed -i 's/async execute(_toolCallId, params, _onUpdate, _ctx, _signal)/async execute(_toolCallId: string, params: any, _onUpdate: OnUpdate, _ctx: ToolContext, _signal: AbortSignal)/g' "$file"
  fi
done