import { readFileSync } from 'fs';
import { resolve } from 'path';

export const schema = readFileSync(
  resolve(__dirname, 'schema.graphql'),
  'utf8',
);
