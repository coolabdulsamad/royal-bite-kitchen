interface SectionPlaceholderProps {
  title: string;
  phase: string;
  description: string;
}

export function SectionPlaceholder({ title, phase, description }: SectionPlaceholderProps) {
  return (
    <section className="max-w-2xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
        {phase}
      </p>
      <h2 className="mt-3 font-display text-3xl text-royal-cream sm:text-4xl">{title}</h2>
      <div className="mt-4 h-px w-16 bg-royal-line" />
      <p className="mt-5 text-sm leading-6 text-royal-dim">{description}</p>
      <p className="mt-10 border border-dashed border-royal-line px-4 py-3 text-xs leading-5 text-royal-dim">
        This section is under construction. The navigation is live so you can feel
        the app&apos;s structure — the full feature arrives in the step shown above.
      </p>
    </section>
  );
}
