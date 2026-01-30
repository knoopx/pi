# Vitest Testing Skill

Comprehensive guide for testing with Vitest - the fast unit testing framework powered by Vite.

## Files

- **SKILL.md** - Quick start guide with setup, configuration, and BDD examples
- **REFERENCE.md** - Advanced configuration, anti-patterns, and best practices
- **mocking-modules.md** - Basic module mocking patterns
- **filesystem-mocking.md** - Filesystem mocking with memfs
- **requests-mocking.md** - HTTP request mocking with msw

## Quick Links

- [Setup & Configuration](./SKILL.md#quick-start)
- [Running Tests](./SKILL.md#running-tests)
- [Test Pyramid](./SKILL.md#test-pyramid--best-practices)
- [BDD Structure](./SKILL.md#bdd-test-structure)
- [Mocking Dependencies](./mocking-modules.md)
- [Mocking Filesystem](./filesystem-mocking.md)
- [Mocking HTTP Requests](./requests-mocking.md)

## Common Commands

```bash
# Run tests
bun vitest run

# Watch mode
bun vitest

# With coverage
bun vitest run --coverage

# Type checking
bun vitest typecheck
```

## Related Skills

- **typescript**: Type safety for tests
- **bun**: Package management and scripting
- **ast-grep**: Pattern matching for refactoring
