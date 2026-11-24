export type FaqItem = { question: string; answer: string };

/** "Before you book" questions, plus matching FAQPage structured data built from the same list. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section id="faq" className="section faq">
      <div className="section-head">
        <p className="eyebrow">Questions</p>
        <h2>Before you book</h2>
      </div>
      <div className="faq-list">
        {items.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }),
        }}
      />
    </section>
  );
}
