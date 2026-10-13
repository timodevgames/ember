// Pin the timezone so day-boundary and DST tests behave the same everywhere.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'Europe/Berlin';
