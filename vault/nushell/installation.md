# Installing Nu

Use one of these options:

## Package managers

- Install from your OS package manager when available.
- On Windows, install with winget.

```bash
winget install nushell
```

## Build from source

Requires Rust toolchain.

```bash
cargo build --workspace
cargo run
```

Release build:

```bash
cargo build --release --workspace
cargo run --release
```

After installation, launch Nushell with:

```bash
nu
```

## Next reading

- [Getting Started](/book/getting_started.html)
- [Quick Tour](/book/quick_tour.html)
