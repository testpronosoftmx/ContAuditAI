'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/app/dashboard',       label: 'Dashboard'      },
  { href: '/app/cfdi',            label: 'CFDIs'          },
  { href: '/app/banco',           label: 'Banco / SPEI'   },
  { href: '/app/conciliaciones',  label: 'Conciliaciones' },
  { href: '/app/alertas',         label: 'Alertas'        },
  { href: '/app/vault',           label: 'Evidencias'     },
  { href: '/app/configuracion',   label: 'Configuración'  },
  { href: '/app/ayuda',           label: 'Ayuda'          },
]

export default function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {navLinks.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + '/')
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-indigo-500/20 text-indigo-300 font-medium'
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
