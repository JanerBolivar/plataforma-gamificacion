import { Role, UserStatus } from '@prisma/client';

export interface UserPayload {
  sub: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface MicrosoftUserGraph {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string | null;
  userPrincipalName?: string;
}

export interface MicrosoftTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}
