import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/services/channel-config', () => ({
  getChannelConfig: vi.fn(),
}));

vi.mock('@/services/marketplaces', () => ({
  refreshOlxToken: vi.fn(),
}));

import { getChannelConfig } from '@/services/channel-config';
import { refreshOlxToken } from '@/services/marketplaces';
import { refreshMarketplaceTokens } from './marketplace-token-refresh';

const mockedGetConfig = getChannelConfig as unknown as ReturnType<typeof vi.fn>;
const mockedRefresh = refreshOlxToken as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe('refreshMarketplaceTokens', () => {
  it('skips OLX when not enabled', async () => {
    mockedGetConfig.mockResolvedValue({ enabled: false, clientId: 'x', refreshToken: 'y' });
    const results = await refreshMarketplaceTokens();
    expect(results).toEqual([]);
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('skips OLX when refresh token missing', async () => {
    mockedGetConfig.mockResolvedValue({ enabled: true, clientId: 'x' });
    const results = await refreshMarketplaceTokens();
    expect(results).toEqual([]);
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('refreshes OLX on success', async () => {
    mockedGetConfig.mockResolvedValue({
      enabled: true,
      clientId: 'x',
      clientSecret: 'y',
      refreshToken: 'z',
    });
    mockedRefresh.mockResolvedValue({ success: true, expiresIn: 3600 });
    const results = await refreshMarketplaceTokens();
    expect(results).toEqual([{ platform: 'olx', refreshed: true, expiresIn: 3600, error: undefined }]);
  });

  it('reports OLX refresh failure', async () => {
    mockedGetConfig.mockResolvedValue({
      enabled: true,
      clientId: 'x',
      refreshToken: 'z',
    });
    mockedRefresh.mockResolvedValue({ success: false, error: 'invalid_grant' });
    const results = await refreshMarketplaceTokens();
    expect(results[0]).toMatchObject({ platform: 'olx', refreshed: false, error: 'invalid_grant' });
  });
});
