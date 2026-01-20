#!/usr/bin/env nu

let selected = [
    "grok-code",
    "glm-4.7-free",
    "minimax-m2.1-free",
    "big-pickle"
]

def make-cost [input] {
    let m = {
        "input": 0.0,
        "output": 0.0,
        "cache_read": 0.0,
        "cache_write": 0.0,
    } | merge $input

    return {
        "input": $m.input,
        "output": $m.output,
        "cacheRead": $m.cache_read,
        "cacheWrite": $m.cache_write,
    }
}

let $zen_models = curl -q https://models.dev/api.json | from json | get opencode.models | values | each { |m|
  if $m.id in $selected {
    echo ({
        "id": $m.id,
        "name": $m.name,
        "family": $m.family,
        "attachment": $m.attachment,
        "reasoning": $m.reasoning,
        "tool_call": $m.tool_call,
        "temperature": $m.temperature,
        "release_date": $m.release_date,
        "last_updated": $m.last_updated,
        "input": $m.modalities.input,
        "output": $m.modalities.output,
        "open_weights": $m.open_weights,
        "cost": (make-cost $m.cost),
        "contextWindow": $m.limit.context,
        "maxTokens": $m.limit.output,
    })
  }
}

open agent/models.json | merge {
    "providers": {
        ...($in.providers | reject zen),
        "zen": {
            ...($in.providers.zen | reject models),
            "models": $zen_models
        }
    }
} | to json
