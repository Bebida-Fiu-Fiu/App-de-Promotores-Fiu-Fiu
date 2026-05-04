import 'server-only';

import { getPromotorMe } from '@/lib/api/promotor';

export async function getHeaderFullName(accessToken: string, fallbackFullName: string | null) {
  try {
    const profile = await getPromotorMe(accessToken);
    return profile.fullName ?? fallbackFullName;
  } catch {
    return fallbackFullName;
  }
}
