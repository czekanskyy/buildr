import { createMemoryDataSource } from '@next-buildr/core';
import { runDataSourceContract } from './data-source.ts';

runDataSourceContract('MemoryDataSource', (fixture) => createMemoryDataSource(fixture));
