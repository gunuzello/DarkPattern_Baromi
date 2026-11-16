"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export function SideNav() {
  const pathname = usePathname() ?? "";
  const items: { href: string; label: string; icon: IconName; current: boolean }[] = [
    {
      href: "/shops",
      label: "내 쇼핑몰",
      icon: "shop",
      current: pathname.startsWith("/shops") || pathname.startsWith("/shop/") || pathname.startsWith("/report") || (pathname.startsWith("/scan/") && pathname !== "/scan/new"),
    },
    { href: "/scan/new", label: "새 점검", icon: "plus", current: pathname === "/scan/new" },
    { href: "/criteria", label: "탐지 기준", icon: "book", current: false },
  ];
  return (
    <nav aria-label="서비스 메뉴" className="side__nav">
      {items.map((item) => (
        <Link key={item.label} href={item.href} className="nav-link" aria-current={item.current ? "page" : undefined}>
          <Icon name={item.icon} />{item.label}
        </Link>
      ))}
    </nav>
  );
}
