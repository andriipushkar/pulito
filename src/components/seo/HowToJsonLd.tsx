interface HowToStep {
  name: string;
  text: string;
  imageUrl?: string;
}

interface HowToJsonLdProps {
  name: string;
  description: string;
  steps: HowToStep[];
  totalTimeIso8601?: string;
  imageUrl?: string;
  /** Optional materials/tools (e.g. "Перчатки", "Сода харчова") */
  supplies?: string[];
}

/**
 * HowTo schema.org block — eligible for the "how-to" rich result in Google
 * SERP (numbered steps appear below the page link).
 *
 * Use only for genuine step-by-step content (e.g. "як вивести пляму від
 * вина"). Adding it to non-instructional posts can trigger manual actions
 * from Google.
 *
 * @example
 *   <HowToJsonLd
 *     name="Як вивести пляму від вина з тканини"
 *     description="Покрокова інструкція для свіжих і застарілих плям."
 *     totalTimeIso8601="PT15M"
 *     supplies={['Сіль', 'Холодна вода', 'Білий оцет']}
 *     steps={[
 *       { name: 'Промокніть пляму', text: 'Серветкою зніміть надлишок рідини…' },
 *       { name: 'Засипте сіллю', text: 'Густо посипте сіллю — вбере залишки…' },
 *     ]}
 *   />
 */
export default function HowToJsonLd({
  name,
  description,
  steps,
  totalTimeIso8601,
  imageUrl,
  supplies,
}: HowToJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    ...(totalTimeIso8601 && { totalTime: totalTimeIso8601 }),
    ...(imageUrl && { image: imageUrl }),
    ...(supplies &&
      supplies.length > 0 && {
        supply: supplies.map((s) => ({ '@type': 'HowToSupply', name: s })),
      }),
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.imageUrl && { image: s.imageUrl }),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
