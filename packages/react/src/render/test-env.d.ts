// Node's filesystem, declared by hand: this package has no @types/node, and one test reads its own sources.
declare module 'node:fs' {
  export function readdirSync(path: URL): string[];
  export function readFileSync(path: URL, encoding: 'utf8'): string;
}
