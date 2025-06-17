# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `bun install` - Install dependencies
- `bun run src/index.ts` - Run the CLI tool with no arguments to see help

### Primary Commands
- `bun run src/index.ts service-glide <repo-path>` - Main command to clean up indirect imports in Glide monorepo
- `bun run src/index.ts fix-package-use <directory>` - Remove unused packages from package.json (use `-f` flag to actually fix)
- `bun run src/index.ts move-file-package <source-file> <target-directory>` - Move files between packages with proper re-exports
- `bun run src/index.ts barrel-export <package-dir> <source-paths...>` - Generate barrel exports for packages
- `bun run src/index.ts rewrite-imports <name> <from-path> <to-path> <source-paths...>` - Change import paths for symbols
- `bun run src/index.ts dedup-imports <source-paths...>` - Combine duplicate imports into single statements
- `bun run src/index.ts resolve-imports <packages-path> <source-paths...>` - Resolve re-exported symbol imports
- `bun run src/index.ts find-unused-exports <repo-path>` - Find exported symbols that aren't imported

### Testing
- Tests are in `src/*.test.ts` files
- Run with `bun test` or `bun run test` (check package.json for exact command)

## Architecture

This is a TypeScript CLI utility designed specifically for managing imports and exports in the Glide monorepo. The tool automates complex refactoring tasks related to package dependencies and import paths.

### Core Concepts
- **Glide Import Paths**: Special handling for `@glide/` prefixed imports with package names and subpaths
- **Tree-sitter Integration**: Uses tree-sitter-typescript for robust TypeScript AST parsing
- **Concurrent Processing**: Built-in concurrency controls for processing large codebases
- **Prettier Integration**: Automatic code formatting after modifications

### Key Components
- `src/glide.ts` - Core Glide-specific utilities and path parsing
- `src/service-glide.ts` - Main orchestration command that runs multiple cleanup operations
- `src/parse-imports.ts` - TypeScript import/export parsing using tree-sitter
- `src/concurrent.ts` - Concurrency utilities for batch operations
- `src/prettier.ts` - Code formatting integration

### Glide Monorepo Structure
The tool expects Glide repositories to have:
- `.topological-packages` file listing package names in dependency order
- `packages/` directory containing individual packages
- `functions/src` and `app/src` directories as additional source locations
- Each package has its own `package.json` and `src/` directory

### Operation Flow
1. Parse TypeScript files using tree-sitter for accurate AST manipulation
2. Analyze import/export relationships across packages
3. Perform transformations (resolve imports, remove re-exports, fix dependencies)
4. Run deduplication and cleanup passes
5. Format modified files with Prettier

The `service-glide` command orchestrates the full cleanup process: resolve imports → remove re-exports → deduplicate imports → fix package dependencies → format code.