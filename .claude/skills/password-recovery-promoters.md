---
name: Password Recovery for Promoters Frontend Integration
description: "Use when: implementing forgot password flow for promoters (promotor) on frontend. Sync with backend 3-step recovery process: request code → verify code → reset password. Specific to promoter authentication."
type: reference
---

# Password Recovery Flow - Promoter Frontend Integration

## Overview
The backend provides a complete password recovery system **exclusively for promoters** with 3 endpoints and 15-minute code expiration. The frontend must implement a 3-step UI flow on the promoter login page.

**Scope:** This flow is for promoter accounts (`/promotor/signin`). Regular users have a separate authentication system.

---

## Integration Points

### Current Status (as of June 2026)
- ✅ Generic forgot password flow implemented at `/forgot-password` and integrated in `/login`
- ✅ Backend endpoints tested and working
- 🔄 Promoter-specific integration in progress at `/promotor/signin`

### Promoter-Specific Endpoints (Same Backend URLs)
All password recovery endpoints are shared (not promoter-specific in URL):

- `POST /password-recovery/request`
- `POST /password-recovery/verify`
- `POST /password-recovery/reset`

**Important:** Backend validates that the email belongs to a promoter in `promotorsTable`. Non-promoter emails will receive generic success response (security).

---

## Implementation Checklist

- [ ] Create promoter-specific login page at `/app/promotor/signin/page.tsx`
- [ ] Create `PromoterLoginForm` component with password recovery flow
- [ ] Create `PromoterForgotPasswordForm` component (can extend generic version)
- [ ] Test with promoter credentials only
- [ ] Test that non-promoter emails are rejected silently (security)
- [ ] Verify redirect to `/promotor` after login success
- [ ] Add promoter-specific branding/messaging

---

## Current Implementation Reference

### Generic Forgot Password (Works for all users)
- **Component:** `components/auth/forgot-password-form.tsx`
- **Page:** `app/forgot-password/page.tsx`
- **Integration:** Linked from `/login`

**Features:**
- 3-step process: email → code verification → password reset
- 15-minute code expiration with countdown timer
- Resend code with 30-second cooldown
- Password strength indicator
- Show/hide password toggles

### Server Actions
Located in `lib/actions.ts`:
- `requestPasswordRecovery(email)` - initiates recovery
- `verifyRecoveryCode(email, code)` - validates code
- `resetPassword(data)` - sets new password

These actions call backend endpoints via `lib/api/promotor.ts`:
- `requestApiPasswordRecovery()`
- `verifyApiRecoveryCode()`
- `resetApiPassword()`

---

## File Structure

```
app/
├── login/
│   └── page.tsx (generic login for all users)
├── promotor/
│   └── signin/
│       └── page.tsx (promoter-specific login - IN PROGRESS)
└── forgot-password/
    └── page.tsx (generic forgot password)

components/auth/
├── login-form.tsx (generic, now has forgot password option)
├── forgot-password-form.tsx (reusable, works for all users)
└── promoter-login-form.tsx (TODO: create if promoter-specific UI needed)

lib/
├── actions.ts (server actions for auth flow)
└── api/
    ├── promotor.ts (API client methods)
    └── client.ts (HTTP client)

lambda/
├── password-recovery-request.ts
├── password-recovery-verify.ts
└── password-reset.ts
```

---

## Testing Checklist

### Happy Path
- [ ] Request code with valid **promoter** email → verify email received
- [ ] Verify with correct 6-digit code → proceeds to password reset
- [ ] Reset password with valid 8+ char password → redirects to `/promotor/signin`

### Error Scenarios
- [ ] Request code with non-promoter email → shows success message, no email sent
- [ ] Request code with invalid email format → validation error
- [ ] Verify with invalid code → "Invalid or expired code"
- [ ] Verify after 15 minutes → "Code expired"
- [ ] Reset with password < 8 chars → validation error
- [ ] Reset with mismatched passwords → "Passwords do not match"

### Security
- [ ] Email enumeration protection: non-existent/non-promoter emails get success message
- [ ] Code expiration: codes invalid after 15 minutes
- [ ] Resend protection: can resend after 30 seconds
- [ ] Rate limiting: max 3 attempts per minute (frontend)
- [ ] Session data cleared on navigation away

---

## API Response Handling

### Success Responses
```json
{
  "success": true,
  "message": "Recovery code sent successfully"
}
```

### Error Responses
```json
{
  "success": false,
  "error": "Invalid email format" | "Code expired" | "Password too short"
}
```

### Validation Errors
```json
{
  "error": [
    {
      "code": "too_small",
      "minimum": 8,
      "type": "string",
      "path": ["password"]
    }
  ]
}
```

---

## Next Steps

1. **If reusing generic component:**
   - Use existing `ForgotPasswordForm` in promoter signin flow
   - Ensure emails are validated as promoter accounts
   - No changes needed to component logic

2. **If creating promoter-specific component:**
   - Create `PromoterForgotPasswordForm` extending generic version
   - Add promoter-specific validation/messaging if needed
   - Test with promoter-only emails

3. **Route handling:**
   - Update `/promotor/signin` to show promoter login form with forgot password option
   - Redirect successful logins to `/promotor` (home for promoters)
   - Link to/from generic `/login` for non-promoters

4. **Documentation:**
   - Update this skill when implementation is complete
   - Add screenshots of promoter signin flow
   - Document any promoter-specific validation logic
