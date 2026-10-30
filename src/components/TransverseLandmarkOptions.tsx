import { Group, Label } from '@radix-ui/react-select'
import { getLandmarksForPlane, TRANSVERSE_LANDMARK_GROUPS } from '@/data/anatomicalLandmarks'
import { SelectItem } from '@/components/ui/select'

export function TransverseLandmarkOptions() {
  const catalog = getLandmarksForPlane('trasverso')
  return <>{TRANSVERSE_LANDMARK_GROUPS.map(group => <Group key={group.category}>
    <Label className="px-2 py-1 text-xs font-semibold">{group.label}</Label>
    {catalog.filter(l => l.category === group.category).map(l => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
  </Group>)}</>
}
