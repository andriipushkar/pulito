'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const SECTIONS = [
  { id: 'overview', key: 'sec_overview' },
  { id: 'olx', key: 'sec_olx' },
  { id: 'rozetka', key: 'sec_rozetka' },
  { id: 'prom', key: 'sec_prom' },
  { id: 'epicentrk', key: 'sec_epicentrk' },
  { id: 'workflow', key: 'sec_workflow' },
  { id: 'messages', key: 'sec_messages' },
  { id: 'returns', key: 'sec_returns' },
  { id: 'troubleshooting', key: 'sec_troubleshooting' },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-8 mb-3 scroll-mt-20 text-xl font-bold">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 mb-2 text-base font-semibold">{children}</h3>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex gap-3 text-sm">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
        {n}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

function Note({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' }) {
  const cls =
    type === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-blue-200 bg-blue-50 text-blue-900';
  return (
    <div className={`my-3 rounded-[var(--radius)] border px-3 py-2 text-sm ${cls}`}>{children}</div>
  );
}

export default function MarketplacesHelpPage() {
  const t = useTranslations('admin.marketplacesHelp');
  const [active, setActive] = useState('overview');

  // Shared rich-text chunk renderers reused across the prose blocks below.
  const b = (c: React.ReactNode) => <strong>{c}</strong>;
  const i = (c: React.ReactNode) => <em>{c}</em>;
  const code = (c: React.ReactNode) => <Code>{c}</Code>;
  const extLink = (href: string, c: React.ReactNode) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--color-primary)] underline"
    >
      {c}
    </a>
  );
  const linkOlx = (c: React.ReactNode) => extLink('https://developer.olx.ua/', c);
  const linkRozetka = (c: React.ReactNode) => extLink('https://seller.rozetka.com.ua/', c);
  const linkProm = (c: React.ReactNode) => extLink('https://my.prom.ua/api', c);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('subtitle')}</p>
      </div>

      <div className="flex gap-6">
        <nav className="sticky top-4 hidden h-fit w-56 shrink-0 space-y-1 md:block">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={`block rounded px-3 py-1.5 text-sm transition-colors ${
                active === s.id
                  ? 'bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {t(s.key)}
            </a>
          ))}
        </nav>

        <article className="prose-sm max-w-none flex-1 text-sm text-[var(--color-text)]">
          <H id="overview">{t('sec_overview')}</H>
          <p>{t.rich('overviewIntro', { b })}</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>{t('overviewLi1')}</li>
            <li>{t('overviewLi2')}</li>
            <li>{t('overviewLi3')}</li>
            <li>{t('overviewLi4')}</li>
            <li>{t('overviewLi5')}</li>
          </ul>

          <Note>{t.rich('overviewNote', { b, i })}</Note>

          <H id="olx">{t('sec_olx')}</H>
          <H3>{t('h3_olxKeys')}</H3>
          <Step n={1}>{t.rich('olxStep1', { a: linkOlx })}</Step>
          <Step n={2}>{t.rich('olxStep2', { code })}</Step>
          <Step n={3}>{t.rich('olxStep3', { code })}</Step>
          <Step n={4}>{t.rich('olxStep4', { i })}</Step>
          <Note type="warn">{t.rich('olxNote', { b, i })}</Note>

          <H id="rozetka">{t('sec_rozetka')}</H>
          <Step n={1}>{t.rich('rozetkaStep1', { a: linkRozetka })}</Step>
          <Step n={2}>{t.rich('rozetkaStep2', { i })}</Step>
          <Step n={3}>{t.rich('rozetkaStep3', { i })}</Step>
          <Step n={4}>{t.rich('rozetkaStep4', { i })}</Step>

          <H id="prom">{t('sec_prom')}</H>
          <Step n={1}>{t.rich('promStep1', { a: linkProm })}</Step>
          <Step n={2}>{t.rich('promStep2', { i })}</Step>

          <H id="epicentrk">{t('sec_epicentrk')}</H>
          <Step n={1}>{t.rich('epicentrkStep1', { code })}</Step>
          <Step n={2}>{t.rich('epicentrkStep2', { i })}</Step>
          <Note type="warn">{t.rich('epicentrkNote', { b })}</Note>

          <H id="workflow">{t('h_workflow')}</H>
          <Step n={1}>{t.rich('workflowStep1', { b, i })}</Step>
          <Step n={2}>{t.rich('workflowStep2', { b, i })}</Step>
          <Step n={3}>{t.rich('workflowStep3', { b, i })}</Step>
          <Step n={4}>{t.rich('workflowStep4', { b, i })}</Step>
          <Step n={5}>{t.rich('workflowStep5', { b })}</Step>

          <H id="messages">{t('h_messages')}</H>
          <p>{t.rich('messagesIntro', { i })}</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>{t.rich('messagesLi1', { b })}</li>
            <li>{t.rich('messagesLi2', { b })}</li>
            <li>{t.rich('messagesLi3', { b, i })}</li>
            <li>{t.rich('messagesLi4', { b })}</li>
          </ul>

          <H id="returns">{t('h_returns')}</H>
          <p>{t.rich('returnsPara1', { b, i })}</p>
          <p>{t.rich('returnsPara2', { i })}</p>

          <H id="troubleshooting">{t('sec_troubleshooting')}</H>
          <H3>{t('h3_redBadge')}</H3>
          <p>{t.rich('tsRedBadge', { i })}</p>

          <H3>{t('h3_invalidCategory')}</H3>
          <p>{t.rich('tsInvalidCategory', { i })}</p>

          <H3>{t('h3_oversell')}</H3>
          <p>{t('tsOversell')}</p>

          <H3>{t('h3_credsGone')}</H3>
          <p>{t.rich('tsCredsGone', { b, i })}</p>

          <H3>{t('h3_cronNoImport')}</H3>
          <p>{t.rich('tsCronNoImport', { code })}</p>

          <Note>{t.rich('footerNote', { b, code })}</Note>
        </article>
      </div>
    </div>
  );
}
