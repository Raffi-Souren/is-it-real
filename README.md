# Is It Real?

**Multi-signal authenticity verification for images and text.**

[![Live Demo](https://img.shields.io/badge/demo-live-green)](https://is-it-real.vercel.app)
[![arXiv](https://img.shields.io/badge/arXiv-2511.07585-b31b1b)](https://arxiv.org/abs/2511.07585)

**[Try the Live Demo](https://is-it-real.vercel.app)**

Provenance-first architecture with ensemble AI detection. Built on principles from LLM Output Drift research (arXiv:2511.07585).

> **Disclaimer:** This tool provides probabilistic assessments, not definitive verdicts. AI detection is inherently uncertain—use results as one signal among many, not as absolute proof. Always apply human judgment for high-stakes decisions.

## Features

- **Image Verification**: Deepfake detection via Hive AI, SightEngine, Vision LLM Council
- **Vision LLM Council**: Uses vision-capable LLMs (Gemini 2.0 Flash) to analyze images for AI artifacts - inspired by [LLM Council](https://github.com/karpathy/llm-council) approach
- **Text Verification**: AI-generated text detection via GPTZero, Originality.AI
- **Provenance-First**: C2PA Content Credentials check before probabilistic detection
- **Ensemble Scoring**: Multiple detectors with variance-based confidence
- **Heuristics**: No-API pattern analysis for both images and text

## Why Multi-Signal?

**The Problem:**
- 120B parameter models show only 12.5% output consistency
- Single detectors suffer from the same stochastic behavior they detect
- No audit trail for enterprise compliance

**The Solution:**
- Provenance-first: C2PA credentials (cryptographic) override detection
- Ensemble detection: Multiple specialized detectors
- Variance tracking: High disagreement flags for manual review

## Quick Start

```bash
# Clone
git clone https://github.com/Raffi-Souren/is-it-real
cd is-it-real

# Install
npm install

# Set up API keys
cp .env.example .env
# Edit .env with your keys

# Run
npm run dev
```

## API Keys

| Service | Type | Pricing | Link |
|---------|------|---------|------|
| **Gemini** | Image (Vision Council) | **FREE** 1,500/day | [aistudio.google.com](https://aistudio.google.com/apikey) |
| Hive AI | Image | Free tier | [thehive.ai](https://thehive.ai) |
| SightEngine | Image | 2,000 free/mo | [sightengine.com](https://sightengine.com) |
| GPTZero | Text | 10,000 words free/mo | [gptzero.me](https://gptzero.me) |
| Originality.AI | Text | Pay-per-use | [originality.ai](https://originality.ai) |

## Architecture

```
Input (Image or Text)
        ↓
┌───────────────────────────────┐
│  PROVENANCE CHECK (Images)    │  ← C2PA/EXIF (free, instant)
│  If valid → VERIFIED_AUTHENTIC│
└───────────────────────────────┘
        ↓ (if no provenance)
┌───────────────────────────────┐
│  ENSEMBLE DETECTION           │
│  ┌─────────────┬─────────────┐│
│  │ Image:      │ Text:       ││
│  │ Hive AI     │ GPTZero     ││
│  │ SightEngine │ Originality ││
│  │ Vision LLM  │ Heuristics  ││
│  │ Council*    │             ││
│  │ Heuristics  │             ││
│  └─────────────┴─────────────┘│
│  *Uses Gemini 2.0 Flash (FREE)│
│  Weighted average + variance  │
└───────────────────────────────┘
        ↓
┌───────────────────────────────┐
│  VERDICT                      │
│  AUTHENTIC | LIKELY_AUTHENTIC │
│  UNCERTAIN | LIKELY_SYNTHETIC │
│  INCONCLUSIVE (σ > 25)        │
└───────────────────────────────┘
```

## Verdicts

| Verdict | Condition | Action |
|---------|-----------|--------|
| `VERIFIED_AUTHENTIC` | C2PA valid | TRUST |
| `LIKELY_AUTHENTIC` | Score < 30%, σ < 15 | LOW RISK |
| `UNCERTAIN` | Score 30-70% OR σ 15-25 | REVIEW |
| `LIKELY_SYNTHETIC` | Score > 70%, σ < 15 | CAUTION |
| `INCONCLUSIVE` | σ > 25 | MANUAL REVIEW |

## Research Connection

Based on:
- **LLM Output Drift v2** (arXiv:2511.07585): Why single-model approaches fail
- **C2PA Standard**: [c2pa.org](https://c2pa.org)

## License

MIT

---

Built with provenance-first principles. No single-model dependency.
