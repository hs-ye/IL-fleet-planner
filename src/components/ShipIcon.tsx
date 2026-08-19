import { useState } from 'react'
import shipImages from '../ship-images.json'

// Class icons vendored from Gravity Assist (public/ships/classes/).
const CLASS_ICONS: Record<string, string> = {
  Fighter: 'fighter.svg',
  Corvette: 'corvette.svg',
  Frigate: 'frigate.svg',
  Destroyer: 'destroyer.svg',
  Cruiser: 'cruiser.svg',
  Battlecruiser: 'battlecruiser.svg',
  Auxiliary: 'auxiliary ship.svg',
  Carrier: 'carrier.svg',
  Battleship: 'battleship.svg',
  Landing: 'landing ship.svg',
}

const IMG = (path: string) => `${import.meta.env.BASE_URL}${path}`

interface Props {
  shipKey: string
  /** Ship class to fall back to when no ship PNG exists (e.g. 'Carrier'). */
  classFallback?: string | null
  size?: number
}

/** Little ship thumbnail; falls back to the class SVG icon, then to nothing. */
export default function ShipIcon({ shipKey, classFallback, size = 26 }: Props) {
  const [broken, setBroken] = useState(false)
  const file = (shipImages as Record<string, string>)[shipKey]
  if (file && !broken) {
    return (
      <img
        src={IMG(`ships/${file}`)}
        alt=""
        loading="lazy"
        height={size}
        className="ship-icon"
        onError={() => setBroken(true)}
      />
    )
  }
  const cls = classFallback ? CLASS_ICONS[classFallback] : undefined
  if (cls) {
    return (
      <img
        src={IMG(`ships/classes/${encodeURIComponent(cls)}`)}
        alt=""
        height={size}
        className="ship-icon class-icon"
      />
    )
  }
  return null
}
