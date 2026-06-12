import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { Resend } from 'resend';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email } = JSON.parse(event.body || '{}');

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ message: 'E-mail é obrigatório.' }) };
    }

    const client = await pool.connect();
    try {
      const userResult = await client.query('SELECT id FROM promotors WHERE email = $1', [email]);
      
      // Retorna sucesso mesmo se não encontrar para evitar enumeração de e-mails
      if (userResult.rowCount === 0) {
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      await client.query(
        `INSERT INTO password_recovery_codes (email, code, expires_at) 
         VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3`,
        [email, code, expiresAt]
      );

      await resend.emails.send({
        from: 'Fiu Fiu <nao-responda@fiufiu.com.br>',
        to: email,
        subject: 'Código de Recuperação - App Fiu Fiu',
        html: `<p>Seu código de recuperação é: <strong>${code}</strong></p>`,
      });

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Erro ao processar solicitação.' }) };
  }
};