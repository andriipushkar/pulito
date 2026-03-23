// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockUseSWR = vi.fn();
const mockMutate = vi.fn();

vi.mock('swr', () => ({
  default: (...args: any[]) => mockUseSWR(...args),
  mutate: (...args: any[]) => mockMutate(...args),
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));
vi.mock('./ChatMessageList', () => ({
  default: ({ messages, isLoading }: any) => (
    <div data-testid="message-list">
      {isLoading ? 'Loading...' : `${messages.length} messages`}
    </div>
  ),
}));
vi.mock('./ChatInput', () => ({
  default: ({ onSend, disabled }: any) => (
    <div data-testid="chat-input">
      <button onClick={() => onSend('test')} disabled={disabled}>Send</button>
    </div>
  ),
}));

import ChatWidget from './ChatWidget';

describe('ChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('renders the chat bubble button', () => {
    render(<ChatWidget />);
    expect(screen.getByTestId('chat-bubble')).toBeInTheDocument();
  });

  it('has correct aria-label on bubble', () => {
    render(<ChatWidget />);
    expect(screen.getByLabelText('Чат підтримки')).toBeInTheDocument();
  });

  it('does not show chat panel by default', () => {
    render(<ChatWidget />);
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();
  });

  it('opens chat panel on bubble click', () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByTestId('chat-bubble'));
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
  });

  it('shows "Підтримка" header when no active room', () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByTestId('chat-bubble'));
    expect(screen.getByText('Підтримка')).toBeInTheDocument();
  });

  it('shows empty state when no rooms', () => {
    mockUseSWR.mockReturnValue({ data: { rooms: [], unreadCount: 0 }, isLoading: false });
    render(<ChatWidget />);
    fireEvent.click(screen.getByTestId('chat-bubble'));
    expect(screen.getByText('У вас ще немає чатів')).toBeInTheDocument();
  });

  it('shows "Новий чат" button', () => {
    mockUseSWR.mockReturnValue({ data: { rooms: [], unreadCount: 0 }, isLoading: false });
    render(<ChatWidget />);
    fireEvent.click(screen.getByTestId('chat-bubble'));
    expect(screen.getByTestId('chat-new-room')).toHaveTextContent('Новий чат');
  });

  it('closes chat panel on second bubble click', () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByTestId('chat-bubble'));
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-bubble'));
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();
  });
});
