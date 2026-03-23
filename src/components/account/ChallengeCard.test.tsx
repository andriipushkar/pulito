// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import ChallengeCard from './ChallengeCard';

const makeChallenge = (overrides: any = {}) => ({
  id: 1,
  name: 'Buy 5 times',
  description: 'Make 5 purchases this month',
  type: 'order_count',
  target: 5,
  reward: 100,
  currentValue: 3,
  isCompleted: false,
  isRewarded: false,
  endDate: null,
  ...overrides,
});

describe('ChallengeCard', () => {
  it('renders challenge name', () => {
    render(<ChallengeCard challenge={makeChallenge()} />);
    expect(screen.getByText('Buy 5 times')).toBeInTheDocument();
  });

  it('renders challenge description', () => {
    render(<ChallengeCard challenge={makeChallenge()} />);
    expect(screen.getByText('Make 5 purchases this month')).toBeInTheDocument();
  });

  it('renders progress as current/target', () => {
    render(<ChallengeCard challenge={makeChallenge()} />);
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('renders reward points', () => {
    render(<ChallengeCard challenge={makeChallenge()} />);
    expect(screen.getByText('+100 балів')).toBeInTheDocument();
  });

  it('renders type icon for order_count', () => {
    render(<ChallengeCard challenge={makeChallenge({ type: 'order_count' })} />);
    expect(screen.getByText('🛒')).toBeInTheDocument();
  });

  it('renders default icon for unknown type', () => {
    render(<ChallengeCard challenge={makeChallenge({ type: 'unknown_type' })} />);
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  it('shows completed message when isCompleted and not rewarded', () => {
    render(<ChallengeCard challenge={makeChallenge({ isCompleted: true, isRewarded: false })} />);
    expect(screen.getByText('Виконано! Бонус нараховано.')).toBeInTheDocument();
  });

  it('does not show completed message when rewarded', () => {
    render(<ChallengeCard challenge={makeChallenge({ isCompleted: true, isRewarded: true })} />);
    expect(screen.queryByText('Виконано! Бонус нараховано.')).not.toBeInTheDocument();
  });

  it('shows end date when not completed and endDate is set', () => {
    render(<ChallengeCard challenge={makeChallenge({ endDate: '2025-12-31T00:00:00Z' })} />);
    expect(screen.getByText(/До/)).toBeInTheDocument();
  });

  it('does not show end date when completed', () => {
    render(<ChallengeCard challenge={makeChallenge({ isCompleted: true, endDate: '2025-12-31T00:00:00Z' })} />);
    expect(screen.queryByText(/До \d/)).not.toBeInTheDocument();
  });
});
