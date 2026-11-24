import 'katex/dist/katex.min.css'
import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { cn } from '@/lib/cn'

/**
 * Hiển thị nội dung câu hỏi/đáp án: Markdown + công thức LaTeX ($...$, $$...$$).
 * Ảnh chèn bằng cú pháp Markdown ![](url) hiển thị bo góc, giới hạn chiều cao.
 */
function MarkdownContentBase({
  children,
  className,
}: {
  children: string | null | undefined
  className?: string
}) {
  const text = children ?? ''
  if (!text.trim()) return null
  return (
    <div
      className={cn(
        'prose-content text-[15px] leading-relaxed text-foreground [&_p]:my-1 [&_img]:my-2 [&_img]:max-h-80 [&_img]:rounded-xl [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

export const MarkdownContent = memo(MarkdownContentBase)
