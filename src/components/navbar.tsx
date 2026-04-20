"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "./ui/button";
import { UserControl } from "./user-control";

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
            <SignedOut>
              <div className="flex items-center gap-2">
                <SignInButton>
                  <Button variant="default" size="sm">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton>
                  <Button variant="secondary" size="sm">
                    Sign Up
                  </Button>
                </SignUpButton>
              </div>
            </SignedOut>

            <SignedIn>
              <Link href="/dashboard" className="flex items-center space-x-2">
                <h2>Dashboard</h2>
              </Link>
              <UserControl showName />
            </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  );
}
