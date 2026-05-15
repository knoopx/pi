---
name: io-wrapper
description: "Wrap file-like objects with read/write counters. Use when implementing IO wrappers, tracking file access, or counting bytes read/written through a proxy."
topic: File-Like Wrapper + Counters
token_cost: 120
related: [recursion-backtracking]
keywords:
  [
    io wrapper,
    wrap file,
    read counter,
    write counter,
    nreads,
    nwrites,
    context manager,
    __enter__,
    __exit__,
    passthrough,
    delegate,
    paasio,
    MetaRead,
    MetaWrite,
  ]
---

## When to use

To wrap a file-like object and count reads/writes.

## Rules

- Store the wrapped object as self.\_wrapped
- Implement read(size=-1) by delegating to self.\_wrapped.read(size)
- Increment counters by the length of the RETURNED bytes, NOT the requested size
- For write: increment nwrites by the RETURN VALUE, or by len(data) if the wrapped write returns None
- Expose read_bytes/nreads and write_bytes/nwrites as properties or attributes
- **enter** returns self; **exit** calls self.\_wrapped.**exit** (or close()) and forwards the exception info
- ALWAYS implement close() as a plain method for non-context-manager use
- NEVER count requested bytes — only count what was actually returned/written

## Edge cases

Thread safety: if the test uses threads, wrap counter updates in a threading.Lock.

## Example

```python
class MetaRead:
    def __init__(self, wrapped): self._wrapped = wrapped; self.nreads = 0
    def read(self, size=-1):
        data = self._wrapped.read(size)
        self.nreads += len(data)  # count returned bytes, not requested
        return data
```
