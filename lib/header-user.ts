import 'server-only';

import { getPromotorMe } from '@/lib/api/promotor';
import { getPromotorFullNameByEmail } from '@/lib/commercial';

export async function getHeaderFullName(accessToken: string, fallbackFullName: string | null) {
  try {
    const profile = await getPromotorMe(accessToken);
    return profile.fullName ?? fallbackFullName;
  } catch {
    return fallbackFullName;
  }
}

export async function getVisitConfirmationFullName(
  accessToken: string,
  email: string,
  fallbackFullName: string | null
) {
  const profileFullName = await getHeaderFullName(accessToken, fallbackFullName);

  if (profileFullName) {
    return profileFullName;
  }

  try {
    return (await getPromotorFullNameByEmail(email)) ?? fallbackFullName;
  } catch (error) {
    console.error('Visit confirmation user lookup error:', error);
    return fallbackFullName;
  }
}
