import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import type { MyofascialLineResult, Severity } from '@/types'
import { SEVERITY_LABELS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MyofascialResultCardProps {
  result: MyofascialLineResult
}

export function MyofascialResultCard({ result }: MyofascialResultCardProps) {
  const line = MYOFASCIAL_LINES[result.lineId]

  return (
    <Card className="border-clinical-200">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{line.name}</CardTitle>
          <Badge variant={result.severity as Severity}>
            {SEVERITY_LABELS[result.severity]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500">Lato prevalente</span>
            <p className="font-medium capitalize">{result.prevalentSide}</p>
          </div>
          <div>
            <span className="text-slate-500">Stato ipotizzato</span>
            <p className="font-medium capitalize">{result.possibleState}</p>
          </div>
        </div>
        <div>
          <span className="text-xs text-slate-500">Distretti coinvolti</span>
          <p className="mt-1 text-xs leading-relaxed">
            {result.involvedDistricts.join(' · ')}
          </p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Tessuti molli correlati</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {result.softTissues.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
