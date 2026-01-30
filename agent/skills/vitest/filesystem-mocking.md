# Filesystem Mocking with Vitest

Vitest doesn't provide built-in filesystem mocking. Use [`memfs`](https://npmjs.com/package/memfs) for in-memory file system simulation.

## Installation

```bash
bun add -D memfs
```

## Setup

Create `__mocks__/fs.cjs` and `__mocks__/fs/promises.cjs` files:

```javascript
// __mocks__/fs.cjs
const { fs } = require('memfs')
module.exports = fs
```

```javascript
// __mocks__/fs/promises.cjs
const { fs } = require('memfs')
module.exports = fs.promises
```

## Usage

```typescript
import { beforeEach, expect, it, vi } from "vitest";
import * as fs from 'node:fs';
import { vol, fs } from 'memfs';

// Tell Vitest to use fs mock
vi.mock('node:fs');
vi.mock('node:fs/promises');

beforeEach(() => {
  vol.reset(); // Reset in-memory filesystem
});

it('should read from virtual file system', () => {
  const path = '/hello.txt';
  fs.writeFileSync(path, 'hello world');

  const text = fs.readFileSync(path, 'utf-8');
  expect(text).toBe('hello world');
});

it('can use vol.fromJSON for multiple files', () => {
  vol.fromJSON(
    {
      './dir1/hw.txt': 'hello dir1',
      './dir2/hw.txt': 'hello dir2',
    },
    '/tmp',
  );

  expect(fs.readFileSync('/tmp/dir1/hw.txt', 'utf-8')).toBe('hello dir1');
});
```

## See Also

- [Mocking Requests](./requests-mocking.md)
