import { ReactNode } from "react";

interface DashboardPageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function DashboardPageHeader({
  title,
  description,
  children,
}: DashboardPageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center space-x-4">{children}</div>
        )}
      </div>
    </div>
  );
}
