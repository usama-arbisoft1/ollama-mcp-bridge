import { readFileSync } from 'fs';
import { join } from 'path';
import { Config } from './types';

export function loadConfig(): Config {
  const configPath = join(__dirname, '../config.json');
  const configData = readFileSync(configPath, 'utf-8');
  return JSON.parse(configData) as Config;
}