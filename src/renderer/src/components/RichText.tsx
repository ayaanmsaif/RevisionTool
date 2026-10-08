import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/contrib/mhchem'
import clsx from 'clsx'

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]] as never

const inlineComponents: Components = {
  p: ({ children }) => <>{children}</>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent underline">
      {children}
    </a>
  )
}

const blockComponents: Components = {
  a: inlineComponents.a
}

/**
 * Card text: markdown with LaTeX ($...$) and chemistry (\ce{...}). Raw HTML from imported
 * decks is never rendered.
 */
export const RichText = memo(function RichText({
  text,
  inline,
  className
}: {
  text: string
  inline?: boolean
  className?: string
}): React.JSX.Element {
  const Tag = inline ? 'span' : 'div'
  return (
    <Tag className={clsx('prose-card', className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={inline ? inlineComponents : blockComponents}
        skipHtml
      >
        {text}
      </ReactMarkdown>
    </Tag>
  )
})
