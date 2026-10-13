import { useQuery } from '@tanstack/react-query';
import { mediaService } from '@/api/media.service';
import { STALE_TIME } from '@/config/constants';

/**
 * The upload limits the server enforces, fetched rather than assumed.
 *
 * Every accepted format, size ceiling and duration ceiling the composer shows
 * or checks comes from here. Keeping a local copy of any of them is what let
 * the old helper text end up describing three rules the server had stopped
 * applying, so the values are read at runtime and never mirrored in the
 * frontend.
 */
export const useMediaConstraints = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mediaConstraints'],
    queryFn: () => mediaService.getConstraints(),
    staleTime: STALE_TIME.LONG,
  });

  return { constraints: data, isLoading, isError };
};
