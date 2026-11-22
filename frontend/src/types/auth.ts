export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED';

export interface User {
  id: string;
  microsoftId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithMicrosoft: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
