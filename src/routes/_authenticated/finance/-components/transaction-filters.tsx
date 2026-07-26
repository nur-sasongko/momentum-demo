import { ListFilter } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useFinanceStore } from '#/stores/finance-store'

export function TransactionFilters() {
  const categories = useFinanceStore((s) => s.categories)
  const selectedType = useFinanceStore((s) => s.selectedType)
  const setSelectedType = useFinanceStore((s) => s.setSelectedType)
  const selectedCategory = useFinanceStore((s) => s.selectedCategory)
  const setSelectedCategory = useFinanceStore((s) => s.setSelectedCategory)

  const categoryOptions = selectedType
    ? categories.filter((c) => c.type === selectedType)
    : categories

  const activeCount = (selectedType ? 1 : 0) + (selectedCategory ? 1 : 0)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative gap-1.5 text-sm"
          aria-label="Filters"
        >
          <ListFilter className="size-4 sm:size-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <Badge className="absolute -top-1.5 -right-1.5 size-4 rounded-full p-0 text-[10px] sm:static sm:ml-0.5 sm:size-auto sm:rounded-full sm:px-1.5 sm:py-0">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Type
          </span>
          <Select
            value={selectedType ?? 'all'}
            onValueChange={(v) => {
              const nextType = v === 'all' ? null : (v as 'income' | 'expense')
              setSelectedType(nextType)
              if (
                selectedCategory &&
                nextType &&
                categories.find((c) => c.id === selectedCategory)?.type !==
                  nextType
              ) {
                setSelectedCategory(null)
              }
            }}
          >
            <SelectTrigger size="sm" className="w-full text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Category
          </span>
          <Select
            value={selectedCategory ?? 'all'}
            onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}
          >
            <SelectTrigger size="sm" className="w-full text-sm">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelectedType(null)
              setSelectedCategory(null)
            }}
          >
            Clear filters
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
