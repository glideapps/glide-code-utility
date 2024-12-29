# glide-code-utility

```bash
bun install
```

To run:

```bash
bun run src/index.ts

Usage: index [options] [command]

Options:
  -h, --help                                                      display help for command

Commands:
  fix-package-use [options] [directory]                      Find unused packages in a project directory
  move-file-package <source-file> <target-directory>              Move a file to a package directory and update its
                                                                  exports
  barrel-export <package-dir> <source-paths...>                   Generate a barrel export for a package
  rewrite-imports <name> <from-path> <to-path> <source-paths...>  Rewrite import paths in a project
  count-dependency-imports [directory]                            Iterates through each package dependencies with nx
                                                                  output and counts the imports of each one.  Useful
                                                                  for finding instances of light imports where
                                                                  dependencies could be moved.
  dedup-imports <source-paths...>                                 Rewrites multiple imports of the same package to a
                                                                  single import
  verbatim-imports <source-paths...>                              Rewrites imports to use the verbatim import syntax
                                                                  with explicit extensions
  help [command]                                                  display help for command
```

## fix-package-use

Finds and removes unused packages from `package.json`.

https://www.loom.com/share/f4483e14f81a483e9334e11b24939b2c

```sh
for pkg in `cat ~/Work/glide/.topological-packages` ; do echo $pkg ; if ! bun run src/index.ts fix-package-use -f ~/Work/glide/packages/$pkg ; then break ; fi ; done
```

## move-file-package

This CLI tool moves a TypeScript file from one package to another lower-level
one, leaving behind a file that just re-exports what the original file
exported. It also adds a package dependency to the original package.

https://www.loom.com/share/65c5428c4ebe4ea591e6eec258f35c60

## barrel-export

Generates barrel exports for symbols that are imported from other packages and
updates those to barrel-imports.

https://www.loom.com/share/95d7b9c4f20940c6b4d9db7f8808b710

## rewrite-imports

Changes the path from which a symbol is imported.

https://www.loom.com/share/36cf0c84e1814517bbcb3cc8c1dded0f

## dedup-imports

Fixes duplicate imports by combining them into single import statements.  This
PR was made with it: https://github.com/glideapps/glide/pull/26508

```sh
for pkg in `cat ~/Work/glide/.topological-packages` ; do echo $pkg ; if ! bun run src/index.ts dedup-imports ~/Work/glide/packages/$pkg/src ; then break ; fi ; done && bun run src/index.ts dedup-imports ~/Work/glide/functions/src ~/Work/glide/app/src
```

## verbatim-imports

This converts imports so that they're compatible with the
`verbatimModuleSyntax` option.  This PR was made with it:
https://github.com/glideapps/glide/pull/27568

## resolve-imports

```sh
rm -f /tmp/paths && for pkg in `cat ~/Work/glide/.topological-packages` ; do echo ~/Work/glide/packages/$pkg/src >> /tmp/paths ; done && echo ~/Work/glide/functions/src >> /tmp/paths && echo ~/Work/glide/app/src >> /tmp/paths && bun run src/index.ts resolve-imports ~/Work/glide/packages `cat /tmp/paths`
```

## remove-re-exports

```sh
for pkg in `cat ~/Work/glide/.topological-packages` ; do echo $pkg ; if ! bun run src/index.ts remove-re-exports ~/Work/glide/packages/$pkg/src ; then break ; fi ; done && bun run src/index.ts remove-re-exports ~/Work/glide/functions/src ~/Work/glide/app/src
```
