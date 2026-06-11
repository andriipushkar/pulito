import { describe, it, expect } from 'vitest';
import { extractFaqItems } from './ProductFaqJsonLd';

const QA = '<p><strong>Чи безпечно?</strong> Так, безпечно.</p>';

describe('extractFaqItems', () => {
  it('extracts pairs under the canonical AI heading', () => {
    const html = `<h2>Опис</h2><p>text</p><h3>Питання та відповіді</h3>${QA}`;
    expect(extractFaqItems(html)).toEqual([{ question: 'Чи безпечно?', answer: 'Так, безпечно.' }]);
  });

  it('recognises hand-written variants («Часті питання», FAQ, h2)', () => {
    for (const heading of ['<h2>Часті питання</h2>', '<h3>Поширені питання</h3>', '<h2>FAQ</h2>']) {
      expect(extractFaqItems(`${heading}${QA}`)).toHaveLength(1);
    }
  });

  it('stops at the next heading', () => {
    const html = `<h3>Питання та відповіді</h3>${QA}<h3>Склад</h3><p><strong>Не питання.</strong> Не відповідь.</p>`;
    expect(extractFaqItems(html)).toHaveLength(1);
  });

  it('returns empty when there is no FAQ block', () => {
    expect(extractFaqItems('<h2>Опис</h2><p>text</p>')).toEqual([]);
    // «питання» inside a paragraph (not a heading) must not trigger
    expect(extractFaqItems(`<p>є питання?</p>${QA}`)).toEqual([]);
  });
});
