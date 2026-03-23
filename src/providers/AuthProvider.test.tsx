// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import AuthProvider, { AuthContext } from './AuthProvider';

vi.mock('@/lib/api-client', () => ({
  setAccessToken: vi.fn(),
}));

const mockUser = {
  id: 1,
  email: 'user@example.com',
  role: 'client',
  fullName: 'Test User',
};

function TestConsumer() {
  const { user, isLoading, login, logout, register } = useContext(AuthContext);
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
      <div data-testid="role">{user?.role ?? 'none'}</div>
      <button onClick={() => login('user@example.com', 'pass123')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => register({ email: 'new@example.com', password: 'pass', fullName: 'New' })}>Register</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('provides auth context to children', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('starts with isLoading true', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
  });

  it('refreshes auth on mount and sets user', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { accessToken: 'tok123', user: mockUser } }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual(mockUser);
  });

  it('login sets user on success', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { accessToken: 'tok', user: mockUser } }),
      });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual(mockUser);
    });
  });

  it('login returns error on failure', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Invalid credentials' }),
      });

    let loginResult: { success: boolean; error?: string } | undefined;

    function LoginTestConsumer() {
      const { login, isLoading } = useContext(AuthContext);
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <button onClick={async () => { loginResult = await login('bad@email.com', 'wrong'); }}>Login</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <LoginTestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await userEvent.setup().click(screen.getByText('Login'));

    await waitFor(() => {
      expect(loginResult).toEqual({ success: false, error: 'Invalid credentials' });
    });
  });

  it('logout clears user', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { accessToken: 'tok', user: mockUser } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).not.toBe('null');
    });

    await user.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
  });

  it('expired token refresh clears user', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('provides role-based state', async () => {
    const adminUser = { ...mockUser, role: 'admin' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { accessToken: 'tok', user: adminUser } }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role').textContent).toBe('admin');
    });
  });

  it('register sets user on success (auto-login)', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { accessToken: 'tok', user: { ...mockUser, email: 'new@example.com', fullName: 'New' } },
        }),
      });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await user.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).not.toBe('null');
    });
  });

  it('handles network error during login', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) })
      .mockRejectedValueOnce(new Error('Network error'));

    let loginResult: { success: boolean; error?: string } | undefined;

    function NetworkErrorConsumer() {
      const { login, isLoading } = useContext(AuthContext);
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <button onClick={async () => { loginResult = await login('a@b.com', 'x'); }}>Login</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <NetworkErrorConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await userEvent.setup().click(screen.getByText('Login'));

    await waitFor(() => {
      expect(loginResult).toEqual({ success: false, error: 'Помилка мережі' });
    });
  });

  it('handles network error during refresh', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
  });
});
