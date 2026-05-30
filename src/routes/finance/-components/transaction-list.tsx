import { Trash2 } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  CATEGORY_COLORS,
  filterTransactions,
  formatCurrency,
  formatTransactionDate,
} from '#/lib/finance-utils'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'

import type { Transaction } from '#/stores/finance-store'

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction)
  const colors = CATEGORY_COLORS[transaction.category].badge
  const isIncome = transaction.type === 'income'

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {transaction.note || 'No description'}
          </p>
          <Badge variant="outline" className={cn('shrink-0 border-0', colors)}>
            {transaction.category}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatTransactionDate(transaction.date)}
        </p>
      </div>
      <p
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          isIncome
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400',
        )}
      >
        {isIncome ? '+' : '-'}
        {formatCurrency(transaction.amount)}
      </p>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => deleteTransaction(transaction.id)}
        aria-label="Delete transaction"
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

export function TransactionList() {
  const transactions = useFinanceStore((s) => s.transactions)
  const selectedMonth = useFinanceStore((s) => s.selectedMonth)
  const selectedCategory = useFinanceStore((s) => s.selectedCategory)

  const filtered = filterTransactions(
    transactions,
    selectedMonth,
    selectedCategory,
  )

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {transactions.length === 0
            ? 'No transactions yet.'
            : 'No transactions match your filters.'}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Transactions</h2>
      </div>
      <div>
        {filtered.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} />
        ))}
      </div>
    </div>
  )
}
