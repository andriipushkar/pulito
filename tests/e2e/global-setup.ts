import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  const origin = new URL(baseURL).origin;

  const state = {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: 'cookie-consent-accepted',
            value: JSON.stringify({
              analytics: false,
              marketing: false,
              date: new Date().toISOString(),
            }),
          },
        ],
      },
    ],
  };

  const dir = path.join(__dirname, '.auth');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'storage.json'), JSON.stringify(state));
}
