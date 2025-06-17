# Architecture Documentation

## Overview

This is a sophisticated TypeScript CLI utility designed for large-scale code refactoring and analysis in the Glide monorepo. The tool provides automated import/export management, dependency tracking, and code transformation capabilities using tree-sitter parsing for robust AST manipulation.

## Core Architecture

### 1. Tree-Sitter Based Parsing Engine

**File**: `src/parse-imports.ts`

The foundation of the system is built on tree-sitter parsing for accurate TypeScript AST analysis:

- **Parser Infrastructure**: Uses `tree-sitter-typescript` with support for both `.ts` and `.tsx` files
- **AST Traversal**: Recursive syntax tree traversal to extract import/export nodes
- **Structured Representation**: Converts raw TypeScript statements into typed data structures

**Key Data Structures:**
```typescript
interface ImportName {
    readonly isType: boolean;
    readonly name: string | true | undefined; // true = wildcard, undefined = default
    readonly as: string | undefined;
}

interface Import {
    readonly kind: "import" | "export";
    readonly names: readonly ImportName[];
    readonly path: string;
}

type Part = string | Import; // Alternating string content and structured imports
```

**Parsing Strategy:**
- Preserves original file structure by interspersing string content with parsed objects
- Handles complex TypeScript constructs: type imports, namespace imports, re-exports
- Enables bidirectional transformation (source → AST → source) with `unparseImports()`

### 2. Concurrent Processing Framework

**File**: `src/concurrent.ts`

Simple but effective concurrency management using `p-limit`:
- Controlled concurrency (typically 10 concurrent operations)
- `concurrentForEach` and `concurrentMap` utilities
- Applied across file system operations and refactoring tasks

### 3. File System Abstraction

**File**: `src/support.ts`

Core utilities for file traversal and processing:
- `walkDirectory()`: Recursive directory traversal with async callbacks
- `isTSFile()`: TypeScript file detection (.ts/.tsx extensions)
- Used consistently across all file-processing operations

## CLI Command Architecture

### Command Categories

**File**: `src/index.ts` (Commander.js based)

**Master Commands:**
- `service-glide <repo-path>` - Complete import resolution pipeline
- `count-symbol-uses <repo-path>` - Cross-codebase symbol usage analysis

**Import/Export Operations:**
- `resolve-imports` - Resolve re-exported symbols to original sources
- `dedup-imports` - Consolidate duplicate imports from same modules
- `rewrite-imports` - Change import paths for specific symbols
- `remove-re-exports` - Eliminate unnecessary re-export statements
- `verbatim-imports` - Add explicit file extensions for ES modules

**Dependency Management:**
- `fix-package-use` - Auto-manage package.json based on actual usage
- `move-file-package` - Move files between packages with export updates

**Code Analysis:**
- `find-unused-exports` - Identify and remove unused exported symbols
- `count-imports` - Statistical analysis of import patterns
- `barrel-export` - Generate index files for package re-exports

## Core Refactoring Operations

### 1. Import Resolution System

**File**: `src/resolve-imports.ts`

**Architecture:**
- `ImportResolver` class with memoized parsing for performance
- Recursive resolution through re-export chains
- Handles both relative imports and Glide package imports (`@glide/`)

**Process:**
1. Parse all import statements
2. Follow re-export chains recursively to find ultimate sources
3. Rewrite imports to point directly to original locations
4. Group imports by target module for efficiency
5. Preserve formatting and handle type-only imports

### 2. Symbol Usage Analysis

**File**: `src/count-symbol-uses.ts`

**Two-Pass Architecture:**
1. **Export Collection**: Traverse codebase to collect all exported symbols with file paths
2. **Import Analysis**: Count imports of only internally-exported symbols

**Features:**
- Filters out external library imports (e.g., React)
- Shows export source location for each symbol
- Relative path output for clean repository navigation

### 3. Export Management

**File**: `src/find-unused-exports.ts`

**Process:**
1. **Collection**: Gather all exported and imported symbols across codebase
2. **Analysis**: Cross-reference exports vs imports, excluding test files
3. **Removal**: Use `unexport.ts` for regex-based unused export removal

### 4. Dependency Synchronization

**File**: `src/fix-package-use.ts`

**Process:**
1. Scan source files for Glide package imports (`@glide/`)
2. Compare against current package.json dependencies
3. Add missing dependencies and remove unused ones
4. Use workspace protocol for internal dependencies

## Glide-Specific Architecture

### Monorepo Integration

**File**: `src/glide.ts`

**Domain Logic:**
- Parses `@glide/` package import paths with subpath handling
- Reads `.topological-packages` file for dependency-ordered package list
- Constructs source paths: `packages/*/src`, `functions/src`, `app/src`
- Handles build artifact paths (`dist/js/` transformations)

### Master Workflow Pipeline

**File**: `src/service-glide.ts`

**Complete Refactoring Pipeline:**
1. **Import Resolution**: Resolve re-exported symbols to sources
2. **Re-export Removal**: Remove unnecessary re-export statements  
3. **Import Deduplication**: Consolidate imports in modified files
4. **Dependency Sync**: Update package.json across all packages
5. **Code Formatting**: Apply Prettier to modified files

## Data Flow Architecture

### Processing Pipeline
```
Source Files → Tree-Sitter Parser → Structured AST → Analysis/Transformation → Code Generation → File Writing → Prettier
```

### Key Design Patterns

1. **Parts-Based Representation**: Files as arrays of alternating strings and structured imports
2. **Bidirectional Transformation**: Clean round-trip source ↔ AST via parse/unparse
3. **Incremental Processing**: Track and format only modified files
4. **Type-Aware Processing**: Distinguish type vs value imports throughout pipeline

## Performance Optimizations

- **Memoization**: Cache parsed file contents during resolution operations
- **Controlled Concurrency**: 10-worker limit for file operations
- **Incremental Updates**: Process only actually modified files
- **Efficient Detection**: File extension checks before expensive parsing
- **Lazy Loading**: Parse files only when needed for analysis

## Testing Strategy

**File**: `src/parse-imports.test.ts`

- **Round-trip Testing**: Verify parse → unparse accuracy
- **JSON Test Cases**: Complex scenarios stored as structured test data
- **Comprehensive Coverage**: All TypeScript import/export patterns

## Integration Points

- **Prettier**: Automated formatting after transformations
- **Package Manager**: Workspace dependency management
- **Monorepo Structure**: `.topological-packages` integration
- **Build System**: `dist/js/` path handling for build artifacts

## Usage Patterns

### Development Workflow
```bash
# Complete cleanup after moving code between packages
bun run src/index.ts service-glide ~/Work/glide

# Analyze most-used internal symbols
bun run src/index.ts count-symbol-uses ~/Work/glide

# Clean up unused exports
bun run src/index.ts find-unused-exports ~/Work/glide
```

### Batch Operations
```bash
# Fix dependencies across all packages
for pkg in `cat ~/Work/glide/.topological-packages`; do
  bun run src/index.ts fix-package-use -f ~/Work/glide/packages/$pkg
done
```

This architecture demonstrates a sophisticated approach to large-scale TypeScript refactoring, emphasizing accuracy, performance, and maintainability while handling the complexity of monorepo code organization.