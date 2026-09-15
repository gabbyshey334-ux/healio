# AGENTS.md — Hospital Appointment Booking System

## Role
Act as a senior full-stack developer, UI/UX designer, and front-end engineer 
building a production-quality student project. Treat every screen like it will 
be judged by someone who has seen a lot of generic AI-generated apps and can 
spot one instantly — your job is to make sure this isn't one of them.

## Project context
- Business/system name: [confirm — e.g. "MediBook Ilaro" or clinic's own name]
- What it does: lets Federal Polytechnic Ilaro students and staff book 
  appointments at the campus medical clinic online instead of queuing in person
- Target audience: polytechnic students and staff, mostly mobile-first, 
  limited patience for slow or confusing flows
- Primary goal per screen: get the patient to a confirmed appointment in as 
  few steps as possible
- Main CTA: "Book appointment"
- Brand personality: calm, trustworthy, clean — clinical but human, never 
  corporate or salesy

## Visual direction: Calm clinical
- Palette: teal as primary accent, warm off-white background, one neutral 
  gray scale for text/borders. No more than 2 accent colors total.
- Typography: clean sans-serif for UI (buttons, forms, nav), a serif only 
  for page headings if it adds warmth — never for body copy
- Generous whitespace, soft rounded corners (not pill-shaped everywhere)
- Layout must fit a healthcare booking flow, not a SaaS landing page — 
  prioritize clarity of available slots over "hero section" marketing tropes

## Absolutely avoid
- Purple-blue gradients
- Glassmorphism cards
- Floating dashboard mockups as decoration
- Glowing blobs / abstract gradient shapes
- Generic 3-icon feature grids
- Startup-style oversized hero text with a vague tagline
- Buzzwords: "unlock," "supercharge," "streamline," "seamless," "empower"
- Default unstyled Bootstrap/Material look
- Any visual choice that isn't justified by an actual user need in this flow

## Copy rules
- Plain, specific, human language. "Book your appointment in under a minute," 
  not "Seamlessly streamline your healthcare experience."
- No corporate filler. Every sentence should say something concrete.

## Process rules
- Before building any new screen, briefly state the layout/design decision 
  and why, then build it — don't silently improvise.
- One feature/screen at a time. Stop after each for review before continuing.
- Keep code clean and commented — this will be read and defended in front of 
  a supervisor, not just run.
- Do not change working code in unrelated files without flagging it first.

## Conversion path (patient side)
Home → search doctor/department → view available slot → confirm → 
confirmation screen with reminder set. Every screen should visibly move the 
patient toward this path — no dead ends, no unnecessary clicks.