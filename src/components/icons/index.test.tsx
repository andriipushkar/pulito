// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  Heart, HeartFilled, Cart, User, Search, Menu, Close,
  ChevronLeft, ChevronRight, ChevronDown,
  Phone, Clock, Share, Copy, Star, Filter, Grid, List,
  Sort, Trash, Plus, Minus, Check, Alert, Home, Bell, Edit,
  Facebook, Telegram, Viber, Instagram, TikTok,
  HelpCircle, MessageCircle, Mail, MapPin, Compare, Eye,
} from './index';

const icons = [
  ['Heart', Heart], ['HeartFilled', HeartFilled], ['Cart', Cart], ['User', User],
  ['Search', Search], ['Menu', Menu], ['Close', Close],
  ['ChevronLeft', ChevronLeft], ['ChevronRight', ChevronRight], ['ChevronDown', ChevronDown],
  ['Phone', Phone], ['Clock', Clock], ['Share', Share], ['Copy', Copy],
  ['Star', Star], ['Filter', Filter], ['Grid', Grid], ['List', List],
  ['Sort', Sort], ['Trash', Trash], ['Plus', Plus], ['Minus', Minus],
  ['Check', Check], ['Alert', Alert], ['Home', Home], ['Bell', Bell], ['Edit', Edit],
  ['Facebook', Facebook], ['Telegram', Telegram], ['Viber', Viber],
  ['Instagram', Instagram], ['TikTok', TikTok],
  ['HelpCircle', HelpCircle], ['MessageCircle', MessageCircle],
  ['Mail', Mail], ['MapPin', MapPin], ['Compare', Compare], ['Eye', Eye],
] as const;

describe('Icon components', () => {
  it.each(icons)('%s renders an SVG', (name, Icon) => {
    const { container } = render(<Icon />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('accepts custom size', () => {
    const { container } = render(<Heart size={32} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });

  it('accepts custom className', () => {
    const { container } = render(<Cart className="text-red-500" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('text-red-500')).toBe(true);
  });

  it('uses default size of 24', () => {
    const { container } = render(<Search />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
  });
});
