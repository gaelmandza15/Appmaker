import fs from 'node:fs';
import path from 'node:path';

// Minimal .env loader: keeps the prototype dependency-free.
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

export const config = {
  port: Number(process.env.PORT) || 4173,
  host: process.env.HOST || '127.0.0.1',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
  maxPromptLength: 2000
};
