'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  /** Aktuelle Bewertung. Bei der Anzeige sind Nachkommastellen erlaubt (z.B. 4.3). */
  value: number
  max?: number
  /** Pixelgröße eines Sterns. */
  size?: number
  /** Wenn true, kann der Nutzer klicken/hovern, um eine Bewertung zu setzen. */
  interactive?: boolean
  onChange?: (value: number) => void
  className?: string
}

/**
 * Sterne-Bewertung. Im Anzeigemodus werden Bruchteile exakt gefüllt
 * (überlagerter, abgeschnittener Stern). Im interaktiven Modus klickt
 * der Nutzer ganze Sterne.
 */
export function StarRating({
  value,
  max = 5,
  size = 16,
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)} role={interactive ? 'radiogroup' : 'img'} aria-label={`${value.toFixed(1)} von ${max} Sternen`}>
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1
        const fillPct = Math.max(0, Math.min(1, display - i)) * 100

        const star = (
          <span className="relative inline-block" style={{ width: size, height: size }}>
            <Star
              style={{ width: size, height: size }}
              className="absolute inset-0 fill-transparent text-amber-300/50"
            />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
              <Star
                style={{ width: size, height: size }}
                className="fill-amber-400 text-amber-400"
              />
            </span>
          </span>
        )

        if (!interactive) return <span key={i}>{star}</span>

        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(starValue)}
            onMouseEnter={() => setHover(starValue)}
            onMouseLeave={() => setHover(null)}
            className="cursor-pointer p-0 leading-none transition-transform hover:scale-110"
            aria-label={`${starValue} Sterne`}
          >
            {star}
          </button>
        )
      })}
    </div>
  )
}
