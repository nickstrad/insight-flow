import { ReactNode } from "react";

interface DashboardPageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function DashboardPageHeader({ 
  title, 
  description, 
  children 
}: DashboardPageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex items-center space-x-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}