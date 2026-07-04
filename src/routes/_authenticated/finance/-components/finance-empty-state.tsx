import { Plus, Wallet } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { useFinanceStore } from '#/stores/finance-store'

export function FinanceEmptyState() {
  const setAddTransactionOpen = useFinanceStore((s) => s.setAddTransactionOpen)

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary/10">
        <Wallet className="size-10 text-primary" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        No transactions yet
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Start tracking your income and expenses. Add your first transaction to
        see your balance and spending breakdown.
      </p>
      <Button
        className="mt-6 gap-2"
        onClick={() => setAddTransactionOpen(true)}
      >
        <Plus className="size-4" />
        Add your first transaction
      </Button>
    </div>
  )
}
