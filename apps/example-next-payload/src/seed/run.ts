import { getPayload } from 'payload';
import config from '../payload.config.ts';
import { seed } from './seed.ts';

const payload = await getPayload({ config });
const summary = await seed(payload, (message) => console.log(`+ ${message}`));
console.log('created', summary.created);
console.log('skipped', summary.skipped);
process.exit(0);
