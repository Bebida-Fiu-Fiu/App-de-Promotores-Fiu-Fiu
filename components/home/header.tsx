 'use client';

import Image from "next/image";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions";

export function Header() {
  return (
    <header className="w-full top-0 fixed top-0 left-0 w-full z-50 py-0 px-6 bg-[var(--background)] border-b border-[var(--border)] flex items-center justify-between">

      <Image src="/logo.svg" alt="Logo" width={64} height={64} className="h-16 w-16" />
      <button className="p-2 rounded-full border border-[var(--border)] cursor-pointer hover:bg-[var(--hover)] transition-colors"
        onClick={logout}
      >
        <LogOut/>
      </button>
    </header>
  );
}
