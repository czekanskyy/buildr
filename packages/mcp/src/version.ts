import pkg from '../package.json' with { type: 'json' };

/** Reported as the server version; read from package.json so it can never drift. */
export const MCP_SERVER_VERSION: string = pkg.version;
