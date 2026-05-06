# Astrophysica Playground

Astrophysica Playground is a local interactive studying app for the Solar System, orbital mechanics, black holes, relativity, tensors, and AI-guided physics practice.

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://127.0.0.1:5179. The API runs on http://127.0.0.1:4279.

The app works without an API key. The tutor panel shows a setup message until `LLM_API_KEY` is configured in `.env` and the dev server is restarted.

## What Is Included

- Full Solar System: Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.
- Cinematic Three.js scene with orbit trails, velocity vectors, atmosphere glows, Saturn rings, starfield, and camera controls.
- Editable Earth physics: radius, mass, orbital distance, orbital speed, density lock, reset to real values.
- Physics readouts: gravity, escape velocity, circular orbital speed, period, force, acceleration, energy, angular momentum, stability.
- Black-hole lab: Schwarzschild radius, photon sphere, ISCO, time dilation, redshift, ship travel comparison, worldline and curvature visuals.
- Study tutor API for DeepSeek/OpenAI-compatible chat-completions providers.

## Scripts

```bash
npm run dev        # API + Vite client
npm run build      # production frontend build
npm run start      # build and serve through the API server
npm run typecheck  # TypeScript verification
npm test           # physics formula tests
```

## Notes

This first release uses curated real Solar System constants and educational approximations. It is intended for study, intuition, and interactive exploration rather than research-grade orbital mechanics. Future upgrades can add JPL Horizons/SPICE ephemerides, REBOUND N-body simulation, Kerr black holes, and symbolic tensor engines.
