# Request Mocking with Vitest

Mock HTTP requests to test API clients, web services, and API interactions.

## Installation

```bash
bun add -D msw
```

## Setup

```typescript
// __mocks__/node-fetch.js
const { fetch: mswFetch } = require('msw');
module.exports = { fetch: mswFetch };
```

```typescript
// __mocks__/undici.js
const { Agent: mswAgent } = require('undici');
module.exports = { Agent: mswAgent };
```

## Usage

```typescript
import { beforeEach, expect, it, vi } from "vitest";
import { fetch } from 'node-fetch';

vi.mock('node-fetch');

beforeEach(() => {
  vi.clearAllMocks();
});

it('should fetch data from API', async () => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ name: 'John', age: 30 }),
  });

  const response = await fetch('https://api.example.com/users/1');
  const data = await response.json();

  expect(data).toEqual({ name: 'John', age: 30 });
});

it('can mock multiple responses', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, name: 'Alice' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 2, name: 'Bob' }),
    });

  const res1 = await fetch('https://api.example.com/users/1');
  const res2 = await fetch('https://api.example.com/users/2');

  expect(await res1.json()).toEqual({ id: 1, name: 'Alice' });
  expect(await res2.json()).toEqual({ id: 2, name: 'Bob' });
});
```

## See Also

- [Mocking Filesystem](./filesystem-mocking.md)
