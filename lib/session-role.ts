import type { UserRole } from '@/types/auth';

// O perfil da sessão vem SEMPRE da API (`GET /promotor/me`), que lê o banco.
// Nunca do formulário de cadastro nem de outro dado enviado pelo navegador.
// Sem resposta válida da API, assume o perfil de menor privilégio.
export function resolveRoleFromServer(profile: { role?: unknown } | null | undefined): UserRole {
  return profile?.role === 'comercial' ? 'comercial' : 'promotor';
}
