export type VerifiedGoogleIdentity = {
  subject: string;
  email: string;
  emailVerified: true;
  emailAuthoritative: boolean;
  fullName: string;
  image: string | null;
};
