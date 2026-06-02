import { withRole } from '@/middleware/auth';
import { isBackgroundRemovalEnabled } from '@/services/background-removal';
import { successResponse } from '@/utils/api-response';

export const GET = withRole(
  'manager',
  'admin',
)(async () => {
  return successResponse({
    backgroundRemoval: await isBackgroundRemovalEnabled(),
  });
});
