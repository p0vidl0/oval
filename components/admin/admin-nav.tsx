"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type AdminMenuGroup, activeAdminNavHref } from "@/lib/admin/routes";

export function AdminNav({ groups }: { groups: AdminMenuGroup[] }) {
  const pathname = usePathname();
  const active = activeAdminNavHref(
    pathname,
    groups.flatMap((group) => group.items.map((item) => item.href)),
  );
  return (
    <nav className="nl-admin-nav" aria-label="Админка">
      {groups.map((group) => (
        <div key={group.label} className="nl-admin-nav__group">
          <span className="nl-admin-nav__group-label">{group.label}</span>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.href === active ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
