# Honest Ads 📺

**The Truth Behind The Hype** — A real-time AI commentary app for watching TV advertisements.

Point your phone at your TV during ad breaks and get live, snarky commentary on what brands are *really* trying to sell you.

## Features

- 🎥 **Live Camera Feed** — Point at your TV and watch
- 🤖 **GPT-4 Vision Analysis** — Real-time frame-by-frame commentary
- 🎚️ **Snark Level Slider** — From "Film Student" to "Unhinged Truth-Teller"
- 📱 **PWA** — Install on your phone for the full second-screen experience
- 🔮 **Theory Building** — AI builds running theory of what's being advertised

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Setup

1. Get an OpenAI API key from [platform.openai.com](https://platform.openai.com)
2. Open the app and tap the ⚙️ settings icon
3. Paste your API key and save
4. Grant camera permission when prompted
5. Point your phone at your TV during an ad break
6. Hit **ANALYZE** and enjoy the truth

## Snark Levels

| Level | Persona | Vibe |
|-------|---------|------|
| 1 | Film Student | Analytical, educational |
| 2 | Skeptical Consumer | Informed, questioning |
| 3 | Media-Savvy Friend | Witty, relatable |
| 4 | Corporate Cynic | Biting, incisive |
| 5 | Unhinged Truth-Teller | Chaotic, conspiratorial |

## How It Works

1. Camera captures frames every 3 seconds
2. Frames sent to GPT-4 Vision API
3. AI maintains context across frames, building theories
4. Commentary streams back in real-time
5. Tropes and brand guesses accumulate

## Tech Stack

- React 18 + TypeScript
- Vite
- OpenAI GPT-4o Vision API
- PWA (Service Worker + Manifest)

## API Costs

Using GPT-4o with low-detail images. Rough estimate:
- ~$0.001-0.002 per frame
- At 3-second intervals, a 30-second ad = ~$0.01-0.02
- A full Super Bowl's worth of ads ≈ $2-4

## Future Ideas

- [ ] Audio fingerprinting for automatic ad detection
- [ ] Pre-loaded commentary for known Super Bowl ads
- [ ] Brand knowledge base with corporate dirt
- [ ] Social sharing of best commentary
- [ ] Crowdsourced ad recording network
- [ ] Claude API support as alternative

## License

MIT — Go forth and expose the hype.
