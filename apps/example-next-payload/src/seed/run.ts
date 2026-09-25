import { getPayload } from 'payload';
import config from '../payload.config.ts';
import { seed } from './seed.ts';

const payload = await getPayload({ config });
const summary = await seed(payload, (message) => console.log(`+ ${message}`));
console.log('created', summary.created);
console.log('skipped', summary.skipped);

// An administrator on request (the end-to-end suite and a first local run); never a default account.
const email = process.env['SEED_ADMIN_EMAIL'];
const password = process.env['SEED_ADMIN_PASSWORD'];
if (email && password) {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  });
  if (existing.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: { email, password, name: 'Administrator', role: 'admin' },
      overrideAccess: true,
    });
    console.log(`+ users: ${email}`);
  }
}
// An agent user with an API key for the MCP end-to-end suite (docs/mcp.md): only with BUILDR_MCP=1
// (the users collection has API keys only then) and a key given by the environment. Role `author`:
// it may create and edit drafts, never publish.
const agentEmail = process.env['SEED_AGENT_EMAIL'];
const agentKey = process.env['SEED_AGENT_API_KEY'];
if (process.env['BUILDR_MCP'] === '1' && agentEmail && agentKey) {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: agentEmail } },
    limit: 1,
    overrideAccess: true,
  });
  if (existing.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: agentEmail,
        password: `${agentKey}-pw`,
        name: 'Agent',
        role: 'author',
        enableAPIKey: true,
        apiKey: agentKey,
      },
      overrideAccess: true,
    });
    console.log(`+ users: ${agentEmail} (API key)`);
  }
}
process.exit(0);
