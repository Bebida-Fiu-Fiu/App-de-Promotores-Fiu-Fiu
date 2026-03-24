import Link from 'next/link';

type AppTabsProps = {
  current: 'visitas' | 'agenda';
};

export function AppTabs({ current }: AppTabsProps) {
  const tabs = [
    { href: '/', label: 'Visitas', key: 'visitas' },
    { href: '/agenda', label: 'Agenda', key: 'agenda' },
  ] as const;

  return (
    <nav className="mx-auto mt-6 flex w-full max-w-4xl gap-2 px-6">
      {tabs.map((tab) => {
        const isActive = tab.key === current;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? 'border-[#009c6c] bg-[#009c6c] text-white'
                : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
