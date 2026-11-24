import type { LucideIcon } from 'lucide-react'
import { Hammer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/** Trang tạm thời cho các mục sẽ làm ở bước sau. */
export function PagePlaceholder({
  title,
  description,
  step,
  icon: Icon = Hammer,
}: {
  title: string
  description?: string
  step?: number
  icon?: LucideIcon
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-muted-foreground">{description}</p>}

      <Card className="mt-5">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary-softer text-primary-foreground">
            <Icon className="size-7" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <p className="font-semibold">Phần này đang được xây dựng</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {step ? `Sẽ hoàn thiện ở bước ${step} của kế hoạch.` : 'Sẽ sớm có mặt.'} Cảm ơn bạn đã
            kiên nhẫn nhé!
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
