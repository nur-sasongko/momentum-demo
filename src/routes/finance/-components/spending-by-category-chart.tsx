'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  formatCurrency,
  formatMonthLabel,
  getSpendingByCategory,
} from '#/lib/finance-utils'
import { useFinanceStore } from '#/stores/finance-store'

export function SpendingByCategoryChart() {
  const transactions = useFinanceStore((s) => s.transactions)
  const selectedMonth = useFinanceStore((s) => s.selectedMonth)

  const data = getSpendingByCategory(transactions, selectedMonth)

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5 pb-0">
        <CardTitle className="text-base">Spending by category</CardTitle>
        <CardDescription>
          Expenses in {formatMonthLabel(selectedMonth)}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No expenses recorded for this month.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`
                  }
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.625rem',
                  }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.category} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
