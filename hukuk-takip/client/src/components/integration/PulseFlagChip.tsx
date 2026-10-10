import type { PulseFlag } from '@hukuk-takip/shared'
import { cn } from '@/lib/utils'
import { PULSE_FLAG_CLASSES, PULSE_FLAG_LABELS } from '@/lib/pulse'

export default function PulseFlagChip({ flag, className }: { flag: PulseFlag; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold', PULSE_FLAG_CLASSES[flag], className)}>
      {PULSE_FLAG_LABELS[flag]}
    </span>
  )
}
