"use client";

import { UserButton } from "@clerk/nextjs";

interface Props {
  showName?: boolean;
}

export function UserControl({ showName }: Props) {
  return (
    <div className="flex items-center space-x-4">
      <UserButton showName={showName} />
    </div>
  );
}
