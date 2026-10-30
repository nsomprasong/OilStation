# OilStation dashboard reference selection (30 October 2026)

Five high-star GitHub options checked: shadcn-ui/ui (about 127k, MIT); AdminLTE (45.7k, MIT); Tabler (42k, MIT); Refine (35.7k, MIT); Gentelella v4 (21.5k, MIT).

**Selected:** Gentelella v4, https://github.com/ColorlibHQ/gentelella
Reason: Vanilla JavaScript + Vite 8 + no Bootstrap or React, matching OilStation's existing architecture and avoiding an expensive auth/data migration. GitHub stars are a proxy for community support, NOT a UX quality score.

Design reference only: grouped navigation, accessible mobile drawer, task-first home, information density, quiet operational forms. **No Gentelella source, markup, or assets copied.** Existing client rendering and Supabase RPCs remain intact.

Original problems: dark-on-dark panels, missing icons due to unknown names, ungrouped nav links, narrow or overly long forms, unclear station onboarding steps. No fabricated metrics, charts or transaction states allowed.

QA requirement: run node tests, Vite build, inspect keyboard focus and 390/768/1440 screenshots of authenticated screens with real non-sensitive test data before calling design fully approved.
