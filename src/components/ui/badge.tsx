import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-clinical-200 bg-clinical-100 text-clinical-800',
        lieve: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        moderato: 'border-amber-200 bg-amber-50 text-amber-800',
        severo: 'border-red-200 bg-red-50 text-red-800',
        outline: 'border-slate-300 text-slate-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
