<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# InsightFlow AI project guidance

## Product focus

InsightFlow AI is an AI product diagnostics and user-insight platform for internet product managers and product operations teams. It combines user behavior data, core product metrics, and qualitative user feedback to help users:

- identify product anomalies;
- locate affected user segments;
- analyze key behaviors and conversion funnels;
- connect quantitative signals with feedback;
- organize analysis evidence; and
- form product hypotheses to validate.

AI must not make the final product decision for the user. Clearly distinguish **Evidence (证据)**, **Observation (观察)**, **Inference (推断)**, and **Hypothesis (假设)** in UI and generated analysis.

Learn from established interaction patterns rather than copying a product's code or visual design: PostHog for product analytics, funnels, retention, and event models; OpenPanel for analytics navigation and dashboard structure; Metabase for filters and card-based information; and Dify for AI workflow and diagnostic-process presentation. Check the applicable License (开源许可证) before using any third-party open-source code.

## V1 scope

The planned information architecture is:

- Overview
- AI Diagnostics
- Analytics: Trends, Funnels, Retention, Users
- Insights: Feedback, Reports
- Data: Events, Data Sources
- Settings

Develop **Overview V1 only** unless a task explicitly expands the scope. Do not prebuild complete versions of other modules.

Overview V1 should help a user quickly answer: “How is the product doing?”, “Is there an anomaly worth attention?”, and “Where should I investigate next?” Its initial sections are Global Filters (全局筛选), KPI Cards (核心指标卡), Product Trend (产品趋势), AI Anomalies (AI 异常发现), User Segment (用户分群), and Feedback Topics (反馈主题). The differentiation is joint diagnosis across behavior data, product metrics, and feedback—not merely adding a chat interface.

For this stage, use Demo / Mock Data (演示 / 模拟数据). Do not add a real database, real AI API, authentication or authorization, enterprise features, A/B Testing, Session Replay, or a full BI system. The immediate goal is a real, complete, runnable SaaS Overview page.

## Engineering rules

- Use the existing stack: Next.js, React, TypeScript, Tailwind CSS, ESLint, and App Router (应用路由).
- Prefer small, verifiable iterations. Do not perform a large refactor solely to make the architecture more advanced.
- Use TypeScript by default and keep types clear.
- Split UI into focused, reusable Components (组件); do not grow pages into a single oversized file.
- Before adding a Dependency (依赖), verify whether the current stack can solve the problem, state the concrete problem it solves, and weigh its maintenance cost.
- Do not manually modify `next-env.d.ts` or `package-lock.json`. Change Next.js core configuration only when a task explicitly requires it.
- Never commit `node_modules`, `.next`, API keys, secrets, or sensitive `.env` values.
- After code changes, run `npm run lint` at minimum.
- Before a material change, state which files will change, why, and whether dependencies will be added.

## Working with the project owner

The owner is learning product development through this project. After each meaningful engineering task, explain:

1. which files changed and why;
2. where the core code is;
3. how the page and data flow;
4. the technical concepts a product manager should understand; and
5. how the change was verified.

When requirements are ambiguous, choose the smallest implementation that can be verified, and do not implement multiple unrequested features at once.
