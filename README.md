NutriPlanner AI

## Web app & API (Vercel)

The production site is a static front end (`website/`) plus a **Node.js Express** API packaged as Vercel serverless functions. Each file under `api/` re-exports `backend/server.js`; routing is defined in `vercel.json` (static files + `/api/*`).

- **AI**: OpenRouter (`OPENROUTER_API_KEY`) — chat, scan-food, weekly meal plan.
- **Food search**: USDA FoodData Central — set **`FOOD_API_KEY` or `USDA_API_KEY`** (either name is read; use one). See `backend/.env.example`.
- **Auth / sync**: Supabase (client config in `website/auth-config.js`); optional cloud sync for targets, meals, settings, weekly events.

Deploy: `npx vercel --prod` from the repo root, or connect the repository in the Vercel dashboard. Do not commit `.env` or API keys.

---

## C core (engine)

NutriPlanner AI includes a C-first nutrition management engine designed to provide structured calorie targeting, macro distribution calculations, and daily intake tracking. The system is built with a layered architecture approach, beginning with a tested and portable C core that can later support higher-level interfaces (CLI, web, or mobile clients).

The current repository focuses on delivering a stable and testable Minimum Viable Product (MVP) of the core engine.

⸻

Core Capabilities (MVP)
	•	Daily calorie target computation (loss, maintain, gain)
	•	Macro distribution calculation (protein, carbohydrates, fat)
	•	Dynamic meal logging with memory-safe allocation
	•	Daily totals and remaining intake calculation
	•	Unit testing via CTest
	•	CLI-based demonstration interface
	•	Automated build and test workflow via GitHub Actions

⸻

Architecture Overview

c_core/
  ├── include/        Public API (nutriplanner.h)
  ├── src/            Core logic implementation
  ├── tests/          Unit tests
  └── examples/       CLI demo program

docs/                 Requirements and technical documentation
website/              Project landing page
.github/              CI workflow configuration

The C core is designed as a reusable engine. Future layers will interface with this core rather than duplicating logic.

⸻

Build Instructions

From the repository root:

cmake -S c_core -B c_core/build
cmake --build c_core/build
ctest --test-dir c_core/build --output-on-failure
./c_core/build/cli_demo


⸻

Engineering Principles
	•	Clearly defined API contract
	•	No global mutable state in the core library
	•	Explicit memory management with safe reallocation
	•	Incremental development with test coverage
	•	Clean separation between logic and interface

⸻

Roadmap

Phase 1 — Core C Engine (Current)
	•	Calorie targeting
	•	Macro calculations
	•	Daily meal logging
	•	CLI demonstration

Phase 2 — Planning Layer
	•	Meal schedule generation
	•	Grocery list logic
	•	Budget constraints

Phase 3 — Data Integration
	•	Store pricing and availability
	•	Dietary restriction support

Phase 4 — Computer Vision
	•	AI-based calorie estimation from image input
