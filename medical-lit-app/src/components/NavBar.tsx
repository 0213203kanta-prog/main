"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

const LINKS = [
  { href: "/search", label: "検索" },
  { href: "/keywords", label: "キーワード" },
  { href: "/saved", label: "保存済み" },
];

export default function NavBar() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">文献チェック</span>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <form action={signOut}>
            <button
              type="submit"
              className="ml-2 rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              ログアウト
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
