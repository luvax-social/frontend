import '@tanstack/react-query';
import type { AppError } from '@/api/axiosClient';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: AppError;
  }
}
