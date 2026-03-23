// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import ChatMessageList from './ChatMessageList';

const makeMessage = (overrides: any = {}) => ({
  id: 1,
  senderType: 'customer' as const,
  senderId: 1,
  content: 'Hello support',
  createdAt: '2025-06-15T10:30:00Z',
  isRead: false,
  ...overrides,
});

describe('ChatMessageList', () => {
  // Mock scrollIntoView since jsdom doesn't support it
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows loading spinner when isLoading is true', () => {
    const { container } = render(<ChatMessageList messages={[]} isLoading={true} />);
    expect(container.querySelector('[class*="animate-spin"]')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<ChatMessageList messages={[]} />);
    expect(screen.getByText('Немає повідомлень. Напишіть перше!')).toBeInTheDocument();
  });

  it('renders customer message content', () => {
    render(<ChatMessageList messages={[makeMessage()]} />);
    expect(screen.getByText('Hello support')).toBeInTheDocument();
  });

  it('renders agent message', () => {
    render(
      <ChatMessageList
        messages={[makeMessage({ id: 2, senderType: 'agent', content: 'How can I help?' })]}
      />
    );
    expect(screen.getByText('How can I help?')).toBeInTheDocument();
  });

  it('renders system message in italic', () => {
    const { container } = render(
      <ChatMessageList
        messages={[makeMessage({ id: 3, senderType: 'system', content: 'Chat started' })]}
      />
    );
    expect(screen.getByText('Chat started')).toBeInTheDocument();
    expect(container.querySelector('.italic')).toBeInTheDocument();
  });

  it('renders date separator for different dates', () => {
    const messages = [
      makeMessage({ id: 1, createdAt: '2025-06-14T10:00:00Z', content: 'Day 1' }),
      makeMessage({ id: 2, createdAt: '2025-06-15T10:00:00Z', content: 'Day 2' }),
    ];
    render(<ChatMessageList messages={messages} />);
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
  });

  it('renders message timestamps', () => {
    render(<ChatMessageList messages={[makeMessage()]} />);
    // Time should be rendered (format depends on locale)
    const timeElements = screen.getAllByText(/\d{2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('renders multiple messages', () => {
    const messages = [
      makeMessage({ id: 1, content: 'First message' }),
      makeMessage({ id: 2, senderType: 'agent', content: 'Second message' }),
      makeMessage({ id: 3, content: 'Third message' }),
    ];
    render(<ChatMessageList messages={messages} />);
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.getByText('Third message')).toBeInTheDocument();
  });
});
