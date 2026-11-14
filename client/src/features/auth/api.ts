import { apiClient, ApiError, type SuccessResponse } from '@/lib/api-client';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'ORGANIZER';
  createdAt: string;
  updatedAt: string;
};
export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & {
  name: string;
  accountType: User['role'];
};

export async function getCurrentUser(signal?: AbortSignal): Promise<User | null> {
  try {
    return (await apiClient.get<SuccessResponse<User>>('/auth/me', { signal })).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
export const login = (body: LoginInput) =>
  apiClient.post<SuccessResponse<User>>('/auth/login', { body });
export const registerUser = (body: RegisterInput) =>
  apiClient.post<SuccessResponse<User>>('/auth/register', { body });
export const logout = () => apiClient.post<SuccessResponse<null>>('/auth/logout');
