import { NextResponse } from 'next/server';
import { isDbAvailable } from '@/lib/db';

export async function GET() {
  const postgresEnabled = !!process.env.DATABASE_URL;
  const postgresReadEnabled = process.env.POSTGRES_READ_ENABLED === 'true';
  const postgres = await isDbAvailable();

  const response = {
    status: 'ok',
    postgres,
    postgresEnabled,
    postgresReadEnabled,
    timestamp: new Date().toISOString(),
  };

  // Return 503 only if POSTGRES_READ_ENABLED=true AND Postgres is down
  // Otherwise return 200 (app can function in dual-write mode)
  if (postgresReadEnabled && !postgres) {
    return NextResponse.json(response, { status: 503 });
  }

  return NextResponse.json(response);
}