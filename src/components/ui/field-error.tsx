import { cn } from '#/libs/utils.ts'

function FieldError({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-error"
      className={cn('text-xs text-destructive', className)}
      {...props}
    />
  )
}

export { FieldError }
