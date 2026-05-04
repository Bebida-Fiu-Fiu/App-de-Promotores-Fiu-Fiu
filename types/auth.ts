export const USER_ROLES = ['promotor', 'comercial'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type SessionUser = {
  id: number | null;
  email: string;
  fullName: string | null;
  role: UserRole;
};

export type SessionData = {
  accessToken: string;
  user: SessionUser;
};
