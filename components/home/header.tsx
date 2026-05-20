 'use client';

import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions";

export function Header({ fullName }: { fullName: string | null }) {

  const name = fullName ? fullName.split(' ')[0] : null; // Get the first name if fullName is available
  return (
    <header className="w-full top-0 fixed top-0 left-0 w-full z-50 py-3 px-6 bg-[var(--background)] border-b border-[var(--border)] flex items-center justify-between">
      <h1 className="text-lg font-bold text-[var(--text)]">
        Olá{name ? `, ${name}` : ''}!
      </h1>
      <button className="p-2 rounded-full border border-[var(--border)] cursor-pointer hover:bg-[var(--hover)] transition-colors"
        onClick={logout}
      >
        <LogOut/>
      </button>
    </header>
  );
}
