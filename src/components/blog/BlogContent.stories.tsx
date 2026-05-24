import type { Meta, StoryObj } from '@storybook/react';
import BlogContent from './BlogContent';

const meta: Meta<typeof BlogContent> = {
  title: 'Blog/BlogContent',
  component: BlogContent,
};
export default meta;
type Story = StoryObj<typeof BlogContent>;

export const Default: Story = {
  args: {
    content: `
      <h2>Як обрати засіб для прибирання</h2>
      <p>Обирати засоби для прибирання потрібно з урахуванням типу поверхні, ступеня забруднення та особистих вподобань.</p>
      <h3>Типи поверхонь</h3>
      <ul>
        <li>Керамічна плитка — лужні засоби</li>
        <li>Ламінат — нейтральні pH засоби</li>
        <li>Скло — спиртові розчини</li>
      </ul>
      <blockquote>Завжди тестуйте засіб на невидимій ділянці перед використанням.</blockquote>
      <p>Дотримуйтесь інструкцій торгової марки для досягнення найкращого результату.</p>
    `,
  },
};

export const ShortArticle: Story = {
  args: {
    content: '<p>Коротка стаття з одним абзацом тексту для перевірки стилів.</p>',
  },
};

export const RichContent: Story = {
  args: {
    content: `
      <h2>Порівняння засобів</h2>
      <table>
        <tr><th>Назва</th><th>Ціна</th><th>Рейтинг</th></tr>
        <tr><td>CleanPro 500</td><td>149 ₴</td><td>4.8</td></tr>
        <tr><td>EcoWash Gel</td><td>99 ₴</td><td>4.5</td></tr>
      </table>
      <h3>Висновок</h3>
      <p>Обидва засоби показали <strong>відмінні результати</strong> у тестуванні. Рекомендуємо <a href="/product/cleanpro-500">CleanPro 500</a> для професійного використання.</p>
      <pre><code>Дозування: 50мл на 5л води</code></pre>
    `,
  },
};
