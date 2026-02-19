'use client'

const QUICK_ACTIONS = [
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
    ),
    label: 'Content Gaps',
    description: 'Find topics you\'re missing',
    message: 'Analyze my GSC data and identify content gaps — topics with high impressions but no dedicated page.',
    color: 'text-blue-400',
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 20V10M18 20V4M6 20v-4" />
      </svg>
    ),
    label: 'Weekly Report',
    description: 'Performance overview',
    message: 'Give me a weekly SEO performance report based on my latest GSC data.',
    color: 'text-green-400',
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
    label: 'Generate Brief',
    description: 'Create a content brief',
    message: 'Help me create a content brief for a new article targeting my best opportunity keyword.',
    color: 'text-purple-400',
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    label: 'Declining Keywords',
    description: 'Spot ranking drops',
    message: 'Find keywords where my position has been declining over the past 90 days.',
    color: 'text-red-400',
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    label: 'Quick Wins',
    description: 'Low-effort, high-impact',
    message: 'Find quick win keywords — high impressions but low CTR or position 5-15 that I can improve.',
    color: 'text-yellow-400',
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    label: 'Write Article',
    description: 'Draft a blog post in your voice',
    message: 'I want to write a new blog article. Help me figure out the best topic based on my GSC data and content gaps, then write it for me.',
    color: 'text-orange-400',
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    label: 'Strategy',
    description: 'Monthly content plan',
    message: 'Based on my site content and search data, suggest a content strategy for the next month.',
    color: 'text-cyan-400',
  },
]

interface QuickActionsProps {
  onSendMessage: (message: string) => void
}

export function QuickActions({ onSendMessage }: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 px-3 text-[11px] font-medium text-sidebar-foreground/40 uppercase tracking-widest">
        Quick Actions
      </p>
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => onSendMessage(action.message)}
          className="group flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-sidebar-accent"
        >
          <span className={`mt-0.5 flex-shrink-0 ${action.color} opacity-60 group-hover:opacity-100 transition-opacity`}>
            {action.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground/80 group-hover:text-sidebar-foreground transition-colors leading-tight">
              {action.label}
            </p>
            <p className="text-[11px] text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors truncate">
              {action.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
