import type { Meta, StoryObj } from '@storybook/react';
import Accordion, { AccordionItem } from './Accordion';

const meta: Meta<typeof Accordion> = {
  title: 'UI/Accordion',
  component: Accordion,
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  render: () => (
    <Accordion>
      <AccordionItem title="Як оформити замовлення?">
        <p className="text-sm text-gray-600">
          Додайте товари в кошик, перейдіть до оформлення та заповніть форму доставки.
        </p>
      </AccordionItem>
      <AccordionItem title="Які способи оплати доступні?">
        <p className="text-sm text-gray-600">
          Ми приймаємо оплату карткою, накладений платіж та оплату при отриманні.
        </p>
      </AccordionItem>
      <AccordionItem title="Як повернути товар?">
        <p className="text-sm text-gray-600">
          Ви можете повернути товар протягом 14 днів з моменту отримання.
        </p>
      </AccordionItem>
    </Accordion>
  ),
};

export const WithDefaultOpen: Story = {
  render: () => (
    <Accordion>
      <AccordionItem title="Відкритий за замовчуванням" defaultOpen>
        <p className="text-sm text-gray-600">Цей елемент відкритий при завантаженні сторінки.</p>
      </AccordionItem>
      <AccordionItem title="Закритий елемент">
        <p className="text-sm text-gray-600">Натисніть щоб розгорнути.</p>
      </AccordionItem>
    </Accordion>
  ),
};

export const SingleItem: Story = {
  render: () => (
    <Accordion>
      <AccordionItem title="Умови доставки">
        <p className="text-sm text-gray-600">
          Безкоштовна доставка при замовленні від 1000 грн. Доставка Новою Поштою 1-3 дні.
        </p>
      </AccordionItem>
    </Accordion>
  ),
};
