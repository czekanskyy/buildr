import { createMemoryDataSource } from '@buildr/core';
import { runDataSourceContract } from './data-source.ts';

runDataSourceContract('MemoryDataSource', (fixture) => createMemoryDataSource(fixture));
