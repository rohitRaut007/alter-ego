# Alter Ego OS

alter-ego-os/
├── public/ # Static Assets (Images, Icons, Fonts)
├── src/ # Main Source Code
│ ├── assets/ # Images, SVGs, Lottie files, 3D Models
│ ├── components/ # Reusable UI Components
│ │ ├── hero/ # Hero Section Specific Files
│ │ │ ├── Hero.jsx/tsx # Main Hero Component
│ │ │ ├── HeroAnimation.jsx/tsx # Canvas/Animation Logic
│ │ │ └── Hero.module.css # Hero Section Styles
│ │ ├── ui/ # Buttons, Cards, Modals
│ │ └── os/ # Window, Desktop, Taskbar (if OS theme)
│ ├── hooks/ # Custom React Hooks (e.g., useAnimation, useMousePosition)
│ ├── styles/ or App.css # Global Tailwind / CSS / Animation keyframes
│ ├── utils/ # Helper functions
│ ├── App.jsx/tsx # Main Layout Component
│ └── main.jsx/tsx # Entry point
├── package.json # Dependencies (Framer Motion, Three.js, GSAP, etc.)
└── tailwind.config.js # Custom animations & keyframes config



Build a production-ready frontend for Alter Ego OS, an AI-powered personal transformation platform based on the provided PRD.

Design Direction

Light theme only

Premium, minimal, sophisticated SaaS design

Clean white/off-white backgrounds with subtle neutral tones

Modern typography, generous spacing, soft shadows, rounded cards

Avoid generic productivity-app styling

Feel like a premium combination of AI mentor + personal operating system + executive coaching platform

Fully responsive for desktop, tablet, and mobile

Main App Structure

Create these pages/screens:

Landing Page

Hero headline: “Become the person you were meant to become.”

Short explanation of Alter Ego OS

CTA: “Build My Alter Ego”

Premium visual showing the transformation system

Seven-layer overview

AI Mentor section

How it works

Final CTA

AI Onboarding / Interview

Conversational AI interface

Ask questions about ambition, current position, personality, fears, goals, and timeline

Progress indicator

Clean chat experience

Generate a personalized protocol at the end

Main Dashboard

Personalized greeting

Today's priority

Current 90-day sprint

Daily tasks

Character/habit progress

Knowledge progress

AI Mentor quick access

Progress overview

Seven-Layer Protocol
Create navigation/cards for:

Identity Architecture

Character Stack

Knowledge System

Product / Mission Strategy

Daily Operating System

Presence Architecture

Legacy Timeline

AI Mentor

Persistent conversational interface

Context-aware responses

Suggested prompts

Challenge/accountability cards

Conversation history

Daily OS

Morning Brief

Today's tasks

Deep Work timer

Habit/practice completion

End-of-day reflection

Weekly review

Character Builder

Character traits

Daily/weekly practices

Streaks

Reflection prompts

AI-generated challenges

Knowledge System

Personalized reading list

Learning roadmap

Books/articles

Notes

Collision Notebook

Weekly AI recommendation

Legacy Timeline

2-year / 5-year / life timeline

Milestones

Progress tracking

Quarterly review

Profile & Settings

Personal protocol

Progress

Calendar integration

Privacy/data controls

Account settings

UX Requirements

Use a left sidebar navigation on desktop and bottom/mobile navigation on mobile.

Make the dashboard the primary experience.

Use realistic sample data instead of empty placeholders.

Add hover states, loading states, empty states, success states, and error states.

Add smooth but subtle animations.

Use reusable components.

Maintain consistent spacing, typography, cards, buttons, icons, and navigation.

Make every major interaction functional.

Do not create a static mockup; build an actual working frontend.

Recommended Visual Style

Use:

White / warm-white backgrounds

Black/dark charcoal text

Soft gray borders

Subtle beige/neutral accents

One restrained premium accent color

Minimal gradients

Elegant charts and progress indicators

High-quality icons

Large typography for important goals and identity statements

Tech

Use React + TypeScript + Tailwind CSS with a clean component architecture.

For now, use mock/local data and frontend state where backend functionality is not available. Structure the code so APIs and authentication can easily be connected later.

The final result should feel like a real premium AI product ready for a startup demo, not a generic admin dashboard.


## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
