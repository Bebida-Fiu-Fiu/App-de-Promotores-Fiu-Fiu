import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email, code } = JSON.parse(event.body || '{}');

    if (!email || !code) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Dados insuficientes.' }) };
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM password_recovery_codes WHERE email = $1 AND code = $2 AND expires_at > NOW()',
        [email, code]
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ valid: (result.rowCount ?? 0) > 0 }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Erro ao verificar código.' }) };
  }
};