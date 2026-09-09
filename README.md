# InsightFlow AI

**AI-powered product diagnostics and user insight platform for product managers.**

InsightFlow AI connects product metrics, user behavior, and user feedback into a unified diagnostic workflow for product managers.

Instead of treating dashboards, segments, and feedback as isolated tools, the product is designed to help PMs move from an abnormal signal to affected users, supporting evidence, and eventually a testable hypothesis.

The repository currently contains an **Overview V1 frontend prototype built with mock data**. It does not yet perform real AI diagnostics or process production analytics data.

## Why this project

Product managers often need to move between:

- dashboards;
- funnels;
- user segments;
- feedback systems; and
- AI tools.

InsightFlow AI explores a unified diagnostic workflow:

```text
Metric change
→ affected users
→ behavioral signal
→ user feedback
→ AI-assisted investigation
```

The goal is to make the path from an initial signal to a testable product hypothesis easier to follow.

## Current V1

**Current stage:** Overview V1 / frontend prototype / mock data

The implemented Overview includes:

- a SaaS-style app shell;
- structured sidebar navigation;
- static global filters UI for date range, platform, and user scope;
- KPI cards for DAU, retention, conversion, and feedback;
- a DAU trend visualization;
- an AI anomaly discovery UI populated with mock diagnostic signals;
- affected user segment signals;
- recent feedback topics;
- reusable React and TypeScript components; and
- typed mock data.

The filters and navigation communicate the intended product structure but do not yet power complete analytics workflows. There is currently no real database, AI API, authentication system, or production analytics pipeline.

## Product flow

```text
Product Metrics
      ↓
Anomaly Detection
      ↓
Affected User Segments
      ↓
Behavior & Feedback Signals
      ↓
AI-assisted Investigation
      ↓
Hypothesis Validation
```

Overview currently implements the anomaly-discovery layer. The deeper **Evidence → Observation → Inference → Hypothesis** workflow is planned for AI Diagnostics.

## Product design approach

Product and interaction patterns were studied from:

- [PostHog](https://github.com/PostHog/posthog)
- [OpenPanel](https://github.com/Openpanel-dev/openpanel)

The research focused on information architecture, dashboard hierarchy, sidebar patterns, progressive disclosure, and component boundaries. These established patterns were recombined around InsightFlow AI's product logic rather than copied as a complete design system.

The implementation in this repository is independently written.

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint
- App Router

## Project structure

```text
src/
├── app/
├── components/
│   ├── layout/
│   └── overview/
└── lib/
```

- `app` — routing, global styles, and the page entry point
- `components/layout` — shared product shell and sidebar
- `components/overview` — focused Overview UI modules
- `lib` — typed mock data used by the prototype

## Roadmap

Planned work, not yet implemented:

- AI Diagnostics and an AI-assisted evidence chain
- Trends, Funnels, Retention, and Users analytics
- Feedback Intelligence
- Events and Data Sources
- Real analytics data model and event schema

The intended progression is from the current Overview V1 prototype toward a connected diagnostic workflow, while keeping each milestone small and verifiable.

## Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run code quality checks:

```bash
npm run lint
```

## Status

**Status:** Active development
  
**Current milestone:** Overview V1