export interface Part {
  id: number
  name: string
  manufacturer: 'Northwind' | 'Contoso' | 'Adventure Works'
  price: number
  stock: number
}

export type PartSortField = 'name' | 'price' | 'stock'
export interface PartFilters { manufacturer: Part['manufacturer'] | null }
