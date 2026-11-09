import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-title-row">
    <div>{eyebrow && <span className="welcome-label">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action}
  </div>;
}
