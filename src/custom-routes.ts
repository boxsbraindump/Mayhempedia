export interface CustomRoute {
  id: string
  championId: number
  title: string
  description: string
  damageType: string
  starterItemIds: number[]
  itemIds: number[]
  coreAugmentIds: number[]
  goodAugmentIds: number[]
  trapAugmentIds: number[]
  updatedAt: string
}

export const customRouteKey = (id: string): string => `custom-${id}`
