// Node's filesystem and the component generator, declared by hand: this package has no @types/node,
// and the scaffold tests read and write component directories.
declare module 'node:fs' {
  export function readdirSync(path: URL): string[];
  export function readFileSync(path: URL, encoding: 'utf8'): string;
  export function existsSync(path: URL): boolean;
  export function mkdirSync(path: URL, options: { recursive: true }): void;
  export function writeFileSync(path: URL, data: string): void;
  export function rmSync(path: URL, options: { recursive: true; force: true }): void;
}

declare module '*/gen-component.mjs' {
  export function componentFiles(
    name: string,
    options?: { client?: boolean; namespace?: string },
  ): Record<string, string>;
}
