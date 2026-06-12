import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email, code, password } = JSON.parse(event.body || '{}');

    if (!email || !code || !password) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Dados insuficientes.' }) };
    }

    const client = await pool.connect();
    try {
      const recoveryCheck = await client.query(
        'SELECT 1 FROM password_recovery_codes WHERE email = $1 AND code = $2 AND expires_at > NOW()',
        [email, code]
      );

      if ((recoveryCheck.rowCount ?? 0) === 0) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Código inválido ou expirado.' }) };
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await client.query('BEGIN');
      
      await client.query(
        'UPDATE promotors SET password = $1 WHERE email = $2',
        [hashedPassword, email]
      );
      
      await client.query('DELETE FROM password_recovery_codes WHERE email = $1', [email]);
      
      await client.query('COMMIT');

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Erro ao redefinir senha.' }) };
  }
};