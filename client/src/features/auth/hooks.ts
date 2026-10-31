import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Currency } from '../../types';
import * as authApi from './api';

export const ME_QUERY_KEY = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.fetchMe,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.loginRequest,
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data);
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.signupRequest,
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data);
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(ME_QUERY_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: { name?: string; currency?: Currency; timezone?: string }) => authApi.updateProfileRequest(values),
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data);
    },
  });
}
