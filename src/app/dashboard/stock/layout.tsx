'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  HomeIcon,
  BoxIcon,
  TagIcon,
  UsersIcon,
  ShoppingCartIcon,
  TruckIcon,
  HistoryIcon,
  ChevronLeftIcon,
  ClipboardIcon,
} from '@/components/ui/icons';

const navItems = [
  { href: '/dashboard/stock', label: 'Overview', icon: HomeIcon },
  { href: '/dashboard/stock/products', label: 'Products', icon: BoxIcon },
  { href: '/dashboard/stock/categories', label: 'Categories', icon: TagIcon },
  { href: '/dashboard/stock/suppliers', label: 'Suppliers', icon: UsersIcon },
  { href: '/dashboard/stock/clients', label: 'Clients', icon: UsersIcon },
  { href: '/dashboard/stock/orders', label: 'Orders', icon: ClipboardIcon },
  { href: '/dashboard/stock/delivery', label: 'Delivery', icon: TruckIcon },
  { href: '/dashboard/stock/sales', label: 'Sales', icon: ShoppingCartIcon },
  { href: '/dashboard/stock/purchases', label: 'Purchases', icon: TruckIcon },
  { href: '/dashboard/stock/movements', label: 'Movements', icon: HistoryIcon },
];

export default function StockLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Mobile Horizontal Nav: below the header */}
      <div className="lg:hidden fixed top-[57px] left-0 right-0 z-[35] bg-zinc-950 border-b border-white/10">
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 px-3 py-2 min-w-max">
            <button
              onClick={() => router.push('/dashboard/services')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors shrink-0"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              Back
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard/stock' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area: desktop sub-sidebar is handled by parent layout with margin transition */}
      <div className="pt-12 lg:pt-0">
        {children}
      </div>
    </>
  );
}
