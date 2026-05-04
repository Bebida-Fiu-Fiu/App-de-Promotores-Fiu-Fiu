import { Pool } from '@neondatabase/serverless';

function getDatabaseConnectionString() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];

  const connectionString = candidates.find((value) => typeof value === 'string' && value.trim());

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL nao configurada. Defina DATABASE_URL no arquivo .env com a string de conexao do PostgreSQL.'
    );
  }

  return connectionString;
}

export const pool = new Pool({
  connectionString: getDatabaseConnectionString(),
});
