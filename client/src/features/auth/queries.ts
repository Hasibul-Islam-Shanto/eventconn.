'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, login, logout, registerUser } from './api';

export const authKeys = { all: ['auth'] as const, current: () => ['auth', 'current'] as const };
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.current(),
    queryFn: ({ signal }) => getCurrentUser(signal),
    staleTime: 2 * 60_000,
    retry: (count, error) =>
      !(typeof error === 'object' && error !== null && 'status' in error && error.status === 401) &&
      count < 1,
  });
}
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: ({ data }) => queryClient.setQueryData(authKeys.current(), data),
  });
}
export function useRegister() {
  return useMutation({ mutationFn: registerUser });
}
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.current(), null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    },
  });
}
