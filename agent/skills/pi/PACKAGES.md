# Pi Packages Reference

Pi packages bundle extensions, skills, prompt templates, and themes for sharing via npm or git.

## Install and Manage

```bash
# Install from npm
pi install npm:@foo/bar@1.2.3

# Install from git
pi install git:github.com/user/repo@v1

# Pin versions
pi install npm:@foo/bar@1.2.3

# Update all packages
pi update

# List installed packages
pi list

# Configure packages
pi config

# Test without installing
pi -e git:github.com/user/repo

# Install to project (not global)
pi install -l npm:@foo/bar

# Remove package
pi remove npm:@foo/bar
```

By default, `install` and `remove` write to global settings (`~/.pi/agent/settings.json`). Use `-l` to write to project settings (`.pi/settings.json`) instead. Project settings can be shared with your team, and pi installs any missing packages automatically on startup.

## Package Sources

| Source | Format                         | Notes                      |
| ------ | ------------------------------ | -------------------------- |
| npm    | `npm:@scope/pkg@version`       | Versioned specs are pinned |
| git    | `git:github.com/user/repo@tag` | Cloned locally             |
| local  | `/absolute/path`               | Works in settings only     |

See [REFERENCE.md](REFERENCE.md) for complete package details.

## Package Structure

### Convention Directories

If no `pi` manifest exists, pi auto-discovers resources:

```
my-package/
├── extensions/    # Loads .ts and .js files
├── skills/        # Loads SKILL.md folders
├── prompts/       # Loads .md files
└── themes/        # Loads .json files
```

### Complete Package Structure

```
my-package/
├── package.json            # Required: package metadata
├── package-lock.json       # Required: npm lockfile
├── README.md              # Optional: package documentation
├── extensions/
│   ├── index.ts           # Entry point
│   └── tools.ts
├── skills/
│   └── my-skill/
│       └── SKILL.md
├── prompts/
│   └── review.md
└── themes/
    └── custom.json
```

## Dependencies

Third-party runtime dependencies go in `dependencies` in `package.json`. When pi installs, it runs `npm install` automatically.

### Core Dependencies

```json
{
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "*",
    "@sinclair/typebox": "*"
  }
}
```

See [REFERENCE.md](REFERENCE.md) for dependency details.

## Package Filtering

Filter resources using the object form in settings:

```json
{
  "packages": [
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": ["+themes/custom.json"]
    }
  ]
}
```

- Omit key to load all of that type
- Use `[]` to load none
- `!pattern` excludes matches
- `+path` force-includes exact path
- `-path` force-excludes exact path

## Enable and Disable Resources

Use `pi config` to enable or disable resources:

```bash
pi config --enable-extensions my-extension
pi config --disable-skills my-skill
pi config --enable-packages npm:my-package
```

## Best Practices

- Keep packages focused on a single purpose
- Use TypeScript for extensions and skills
- Include examples in README.md
- Test before publishing
- Document dependencies
- Use semantic versioning

## Publishing Packages

```bash
# npm
npm login
npm publish

# git
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/user/repo.git
git push -u origin main

# Create release
gh release create v1.0.0 --notes "Initial release"
```

For more information, see the [pi-mono documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/packages.md).
