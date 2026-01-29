import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

// Types
interface CommentaryEntry {
  id: string;
  timestamp: number;
  text: string;
  confidence?: 'guessing' | 'suspicious' | 'certain';
}

interface AnalysisState {
  isAnalyzing: boolean;
  currentTheory: string;
  brandGuess: string | null;
  tropeDetected: string[];
  commentary: CommentaryEntry[];
}

// Snark level personas
const SNARK_PERSONAS: Record<number, { name: string; description: string; systemPrompt: string }> = {
  1: {
    name: 'Film Student',
    description: 'Analytical & educational',
    systemPrompt: `You are a thoughtful media studies student watching TV ads. You notice framing choices, color grading, and persuasion techniques. You explain what you see in an educational but engaging way. You're genuinely curious about advertising as a craft, while being aware of manipulation tactics. Keep observations concise - 1-2 sentences max per frame.`
  },
  2: {
    name: 'Skeptical Consumer',
    description: 'Informed & questioning',
    systemPrompt: `You are a well-informed consumer watching TV ads with healthy skepticism. You notice when claims are vague, when fine print contradicts headlines, when emotional manipulation is at play. You ask "but what are they REALLY selling?" You're not mean, just... not buying it. Keep observations concise - 1-2 sentences max per frame.`
  },
  3: {
    name: 'Your Media-Savvy Friend',
    description: 'Witty & relatable',
    systemPrompt: `You are someone's clever friend watching ads together at a party. You make sharp, funny observations about advertising tropes, celebrity endorsements, and corporate BS. You're entertaining but not exhausting. You notice the absurdity in advertising conventions. Keep it punchy - 1-2 sentences max per frame.`
  },
  4: {
    name: 'Corporate Cynic',
    description: 'Biting & incisive',
    systemPrompt: `You are a jaded advertising insider who's seen it all. You immediately recognize every manipulation tactic because you've probably used them. You call out greenwashing, astroturfing, and emotional exploitation with dark humor. You know what's being sold is rarely what's being shown. Keep it sharp - 1-2 sentences max per frame.`
  },
  5: {
    name: 'Unhinged Truth-Teller',
    description: 'Chaotic & conspiratorial',
    systemPrompt: `You are an absolutely unhinged media critic watching ads. You see through EVERYTHING. Every ad is propaganda, every family is fake, every product is a lie wrapped in a lie. You make wild (but weirdly plausible) connections. You speak in ALL CAPS when you catch them in an obvious manipulation. You're paranoid but entertaining. Keep it chaotic - 1-2 sentences max per frame.`
  }
};

// Ad tropes database for enhanced commentary
const AD_TROPES = [
  { trigger: 'family', response: 'Ah yes, the Nuclear Family™ - advertising\'s favorite fiction' },
  { trigger: 'beach', response: 'Beach setting detected. Freedom/escape narrative incoming.' },
  { trigger: 'golden retriever', response: 'GOLDEN RETRIEVER ALERT. Trust score artificially inflated.' },
  { trigger: 'laughing', response: 'Performative laughter. Nobody is this happy about [product].' },
  { trigger: 'slow motion', response: 'Slow-mo = they want you to FEEL something you shouldn\'t.' },
  { trigger: 'white background', response: 'Clinical white void. "Clean" and "pure" subliminal messaging.' },
  { trigger: 'mountain', response: 'Rugged mountain landscape. Masculinity and freedom signifiers.' },
  { trigger: 'kitchen', response: 'Kitchen setting. Targeting the "household decision maker."' },
  { trigger: 'doctor', response: 'Person in white coat detected. Authority figure deployed.' },
  { trigger: 'celebrity', response: 'Celebrity spotted. Parasocial trust transfer in progress.' },
];

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [snarkLevel, setSnarkLevel] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'classic' | 'immersive'>('classic');
  const [immersiveReady, setImmersiveReady] = useState(false);
  
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isAnalyzing: false,
    currentTheory: '',
    brandGuess: null,
    tropeDetected: [],
    commentary: []
  });

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      setError('Camera access denied. Point me at your TV!');
      console.error('Camera error:', err);
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    setIsStreaming(false);
    setAnalysis(prev => ({ ...prev, isAnalyzing: false }));
  }, []);

  // Capture frame from video
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  // Analyze frame with GPT-4 Vision
  const analyzeFrame = useCallback(async (imageData: string, previousContext: string) => {
    const persona = SNARK_PERSONAS[snarkLevel];

    const messages = [
      {
        role: 'system',
        content: `${persona.systemPrompt}

You are watching a TV advertisement frame by frame. Build a running theory of what's being advertised and what manipulation tactics are being used.

Previous observations: ${previousContext || 'Just started watching.'}

Respond with a JSON object:
{
  "commentary": "Your snarky observation about this frame",
  "theory": "Your current theory of what this ad is selling",
  "brandGuess": "Brand name if visible or suspected, null otherwise",
  "confidence": "guessing|suspicious|certain",
  "tropesDetected": ["array of advertising tropes you notice"]
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageData,
              detail: 'low'
            }
          },
          {
            type: 'text',
            text: 'What do you see? Continue your running commentary.'
          }
        ]
      }
    ];

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          max_tokens: 300,
          temperature: 0.9,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content || '';

      // Strip markdown code fences if present
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      // Parse JSON response
      try {
        const parsed = JSON.parse(content);
        return parsed;
      } catch {
        // If still not valid JSON, extract just the commentary text
        return {
          commentary: content.replace(/[{}"]/g, '').trim() || 'Analyzing...',
          theory: analysis.currentTheory,
          brandGuess: null,
          confidence: 'guessing',
          tropesDetected: []
        };
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Analysis failed. Please try again.');
      return null;
    }
  }, [snarkLevel, analysis.currentTheory]);

  // Start live analysis
  const startAnalysis = useCallback(() => {
    if (!isStreaming) return;
    
    setAnalysis(prev => ({ 
      ...prev, 
      isAnalyzing: true,
      commentary: [],
      currentTheory: '',
      brandGuess: null,
      tropeDetected: []
    }));

    let contextWindow = '';
    
    analysisIntervalRef.current = setInterval(async () => {
      const frame = captureFrame();
      if (!frame) return;

      const result = await analyzeFrame(frame, contextWindow);
      
      if (result) {
        const newEntry: CommentaryEntry = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          text: result.commentary,
          confidence: result.confidence
        };

        setAnalysis(prev => ({
          ...prev,
          commentary: [...prev.commentary.slice(-2), newEntry], // Keep last 3 visible
          currentTheory: result.theory || prev.currentTheory,
          brandGuess: result.brandGuess || prev.brandGuess,
          tropeDetected: [...new Set([...prev.tropeDetected, ...(result.tropesDetected || [])])]
        }));

        // Update context window for next analysis
        contextWindow = `Theory: ${result.theory}. Recent: ${result.commentary}`;
      }
    }, 3000); // Analyze every 3 seconds
  }, [isStreaming, captureFrame, analyzeFrame]);

  // Stop analysis
  const stopAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    setAnalysis(prev => ({ ...prev, isAnalyzing: false }));
  }, []);

  // Immersive single-button handler: START → STOP → ANALYZE ANOTHER
  const handleImmersiveAction = useCallback(async () => {
    if (!isStreaming) {
      // START: start camera + begin analysis automatically
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsStreaming(true);
          setError(null);
          // Auto-start analysis after a brief delay for camera to initialize
          setTimeout(() => {
            startAnalysis();
          }, 500);
        }
      } catch (err) {
        setError('Camera access denied. Point me at your TV!');
        console.error('Camera error:', err);
      }
    } else if (analysis.isAnalyzing) {
      // STOP: stop analysis, keep camera
      stopAnalysis();
    } else {
      // ANALYZE ANOTHER: clear state, restart analysis
      setAnalysis({
        isAnalyzing: false,
        currentTheory: '',
        brandGuess: null,
        tropeDetected: [],
        commentary: []
      });
      setTimeout(() => {
        startAnalysis();
      }, 100);
    }
  }, [isStreaming, analysis.isAnalyzing, startAnalysis, stopAnalysis]);

  const immersiveButtonLabel = !isStreaming ? 'START' : analysis.isAnalyzing ? 'STOP' : 'ANALYZE ANOTHER';
  const immersiveButtonClass = !isStreaming ? 'btn-primary' : analysis.isAnalyzing ? 'btn-danger' : 'btn-primary';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Lock body scroll in immersive mode
  useEffect(() => {
    if (viewMode === 'immersive') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [viewMode]);

  if (viewMode === 'immersive' && !immersiveReady) {
    return (
      <div className="app immersive-intro">
        <div className="scanlines" />
        <div className="immersive-intro-content">
          <h1 className="immersive-intro-title">
            <span className="title-honest">HONEST</span>
            <span className="title-ads">ADS</span>
          </h1>
          <p className="immersive-intro-tagline">THE TRUTH BEHIND THE HYPE</p>
          <div className="immersive-intro-instructions">
            <p>Point your camera at any TV ad.</p>
            <p>We'll tell you what they're <em>really</em> selling.</p>
          </div>
          <button className="immersive-intro-go" onClick={() => setImmersiveReady(true)}>
            ENTER THE TRUTH MACHINE
          </button>
          <button className="immersive-intro-back" onClick={() => setViewMode('classic')}>
            back to classic
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'immersive') {
    return (
      <div className="app immersive">
        <div className="scanlines" />

        {/* Fullscreen video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`immersive-video ${isStreaming ? 'active' : ''}`}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Top-left: logo */}
        <div className="immersive-logo">
          <span className="immersive-logo-honest">HONEST</span>
          <span className="immersive-logo-ads">ADS</span>
        </div>

        {/* Analyzing indicator below logo */}
        {analysis.isAnalyzing && (
          <div className="immersive-analyzing">
            <span className="pulse">●</span> ANALYZING
          </div>
        )}

        {/* Top-right: view toggle */}
        <button className="immersive-toggle" onClick={() => { setViewMode('classic'); setImmersiveReady(false); }}>
          CLASSIC
        </button>

        {/* Tropes: horizontal scrolling tags at top */}
        {analysis.tropeDetected.length > 0 && (
          <div className="immersive-tropes">
            {analysis.tropeDetected.map((trope, i) => (
              <span key={i} className="immersive-trope-tag">{trope}</span>
            ))}
          </div>
        )}

        {/* Bottom-left: working theory */}
        {analysis.currentTheory && (
          <div className="immersive-theory">
            <span className="theory-label">WORKING THEORY:</span>
            <p>{analysis.currentTheory}</p>
          </div>
        )}

        {/* Bottom-right: commentary */}
        {analysis.commentary.length > 0 && (
          <div className="immersive-commentary">
            {analysis.commentary.map((entry) => (
              <div key={entry.id} className={`immersive-commentary-entry ${entry.confidence}`}>
                {entry.text}
              </div>
            ))}
          </div>
        )}

        {/* Bottom-center: brand detected */}
        {analysis.brandGuess && (
          <div className="immersive-brand">
            <span className="brand-label">SUSPECT:</span>
            <span className="brand-name">{analysis.brandGuess}</span>
          </div>
        )}

        {/* Center: single action button */}
        <button className={`immersive-action-btn ${immersiveButtonClass}`} onClick={handleImmersiveAction}>
          {immersiveButtonLabel}
        </button>

        {/* Bottom: snark slider */}
        <div className="immersive-snark">
          <span className="immersive-snark-label">{SNARK_PERSONAS[snarkLevel].name}</span>
          <input
            type="range"
            min="1"
            max="5"
            value={snarkLevel}
            onChange={(e) => setSnarkLevel(parseInt(e.target.value))}
            className="immersive-snark-slider"
          />
        </div>

        {/* Placeholder when no camera */}
        {!isStreaming && (
          <div className="immersive-placeholder">
            <span className="placeholder-icon">📺</span>
            <p>POINT AT YOUR TV</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-banner immersive-error">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {/* Scanline overlay */}
      <div className="scanlines" />

      {/* Header */}
      <header className="header">
        <h1 className="title">
          <span className="title-honest">HONEST</span>
          <span className="title-ads">ADS</span>
        </h1>
        <p className="tagline">THE TRUTH BEHIND THE HYPE</p>
        <button className="view-toggle-btn" onClick={() => setViewMode('immersive')}>
          IMMERSIVE
        </button>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Video Feed */}
        <div className="video-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`video-feed ${isStreaming ? 'active' : ''}`}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {!isStreaming && (
            <div className="video-placeholder">
              <span className="placeholder-icon">📺</span>
              <p>POINT AT YOUR TV</p>
            </div>
          )}

          {analysis.isAnalyzing && (
            <div className="analyzing-indicator">
              <span className="pulse">●</span> ANALYZING
            </div>
          )}

          {analysis.brandGuess && (
            <div className="brand-detected">
              <span className="brand-label">SUSPECT:</span>
              <span className="brand-name">{analysis.brandGuess}</span>
            </div>
          )}
        </div>

        {/* Snark Level Control */}
        <div className="snark-control">
          <label className="snark-label">SNARK LEVEL</label>
          <div className="snark-slider-container">
            <input
              type="range"
              min="1"
              max="5"
              value={snarkLevel}
              onChange={(e) => setSnarkLevel(parseInt(e.target.value))}
              className="snark-slider"
            />
            <div className="snark-markers">
              {[1, 2, 3, 4, 5].map(level => (
                <span
                  key={level}
                  className={`marker ${snarkLevel === level ? 'active' : ''}`}
                >
                  {level}
                </span>
              ))}
            </div>
          </div>
          <div className="snark-persona">
            <span className="persona-name">{SNARK_PERSONAS[snarkLevel].name}</span>
            <span className="persona-desc">{SNARK_PERSONAS[snarkLevel].description}</span>
          </div>
        </div>

        {/* Commentary Feed */}
        <div className="commentary-feed">
          <h2 className="commentary-title">LIVE TRANSLATION</h2>

          {analysis.currentTheory && (
            <div className="current-theory">
              <span className="theory-label">WORKING THEORY:</span>
              <p>{analysis.currentTheory}</p>
            </div>
          )}

          <div className="commentary-list">
            {analysis.commentary.length === 0 ? (
              <p className="no-commentary">
                {isStreaming
                  ? 'Hit ANALYZE to start the truth extraction...'
                  : 'Start camera and point at an ad to begin...'}
              </p>
            ) : (
              analysis.commentary.map((entry) => (
                <div
                  key={entry.id}
                  className={`commentary-entry ${entry.confidence}`}
                >
                  <span className="entry-text">{entry.text}</span>
                </div>
              ))
            )}
          </div>

          {analysis.tropeDetected.length > 0 && (
            <div className="tropes-detected">
              <span className="tropes-label">TROPES DETECTED:</span>
              <div className="tropes-list">
                {analysis.tropeDetected.map((trope, i) => (
                  <span key={i} className="trope-tag">{trope}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-banner">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Controls */}
        <div className="controls">
          {!isStreaming ? (
            <button className="btn btn-primary" onClick={startCamera}>
              <span>📷</span> START CAMERA
            </button>
          ) : (
            <>
              {!analysis.isAnalyzing ? (
                <button className="btn btn-primary" onClick={startAnalysis}>
                  <span>🔍</span> ANALYZE
                </button>
              ) : (
                <button className="btn btn-danger" onClick={stopAnalysis}>
                  <span>⏹</span> STOP
                </button>
              )}
              <button className="btn btn-secondary" onClick={stopCamera}>
                <span>✕</span> END SESSION
              </button>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>THEY LIE. WE TRANSLATE.</p>
      </footer>
    </div>
  );
}

export default App;
