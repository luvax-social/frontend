import { z } from 'zod';
import { usernameField, displayNameField, bioField } from '@/utils/validationFields';

// Mirrors backend UpdateProfileRequest: username and displayName share the exact constraints
// RegisterRequest already enforces (see validationFields.js); bio is profile-only.
export const editProfileSchema = z.object({
  username: usernameField,
  displayName: displayNameField,
  bio: bioField,
});
