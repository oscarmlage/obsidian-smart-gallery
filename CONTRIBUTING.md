# Contributing to Smart Gallery

Thank you for your interest in contributing to this project!

## Development setup

### Prerequisites

You can develop using either:
- **Docker** (recommended): No local Node.js installation required
- **Local Node.js**: Node.js 20+ and npm

### Using Docker (recommended)

Build the plugin:
```bash
make docker-build
```

Start development mode with hot reload:
```bash
make docker-dev
```

Run linting:
```bash
make docker-lint
```

Open a shell in the container:
```bash
make docker-shell
```

### Using local Node.js

Install dependencies:
```bash
npm ci
```

Build the plugin:
```bash
npm run build
```

Start development mode:
```bash
npm run dev
```

Run linting:
```bash
npm run lint
```

## Testing the plugin locally

1. Build the plugin using one of the methods above
2. Copy the generated files to your Obsidian vault:
   ```bash
   cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/obsidian-smart-gallery/
   ```
3. Reload Obsidian or enable/disable the plugin

## Project structure

```
src/
├── main.ts              # Plugin entry point
├── utils.ts             # Utility functions
├── Blocks/              # Gallery and image info blocks
├── DisplayObjects/      # Grid, gallery info, filters
├── Modals/              # UI modals and menus
├── Loc/                 # Localization files
└── TechnicalFiles/      # Media search, grammar parsing
```

## Code style

- Use TypeScript
- Follow existing code patterns
- Remove unused imports
- Use the `sleep()` utility instead of inline `setTimeout` promises

## Submitting changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `make docker-lint` to check for errors
5. Commit using [conventional commits](https://www.conventionalcommits.org/) format
6. Push and open a pull request

## License

By contributing, you agree that your contributions will be licensed under the MIT license.
