"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <h1 className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-xl font-semibold text-transparent">
                InsightFlow
              </h1>
            </Link>
          </div>

          <div className="flex items-center space-x-6 pr-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <h2>Dashboard</h2>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
