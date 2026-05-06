import {
  Atom,
  Gauge,
  MessageSquareText,
  Orbit,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  Send,
  Sparkles,
  Telescope,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AU_KM, SCALE_OPTIONS, type ScaleMode } from "../../shared/src/constants";
import { guidedLessons, practicePrompts } from "../../shared/src/lessons";
import {
  calculateEarthPhysics,
  calculateRelativity,
  densityMassKg,
  earthMassDeltaPercent,
  earthRadiusDeltaPercent,
  escapeVelocityKmS,
  surfaceGravity
} from "../../shared/src/physics";
import { earthDefaults, solarBodies } from "../../shared/src/solarSystem";
import type { BlackHoleState, ChatMessage, EditedEarthState, SolarBody } from "../../shared/src/types";
import { AstrophysicaScene } from "./components/SolarSystemScene";

type SceneMode = "solar" | "black-hole";

const defaultBlackHole: BlackHoleState = {
  massSolar: 10,
  shipSpeedFractionC: 0.72,
  observationRadiusMultiplier: 3,
  lightImpactMultiplier: 12,
  launchDistanceAu: 1
};

export function App() {
  const [mode, setMode] = useState<SceneMode>("solar");
  const [selectedId, setSelectedId] = useState("earth");
  const autoPauseArmed = useRef(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [simDays, setSimDays] = useState(0);
  const [timeScale, setTimeScale] = useState(36);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("compressed");
  const [showLabels, setShowLabels] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [powerSave, setPowerSave] = useState(true);
  const [earth, setEarth] = useState<EditedEarthState>(earthDefaults);
  const [blackHole, setBlackHole] = useState<BlackHoleState>(defaultBlackHole);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Choose a planet, edit Earth, or open the black-hole lab. Ask me what the visible numbers mean."
    }
  ]);
  const [chatInput, setChatInput] = useState("Why does Neptune move so slowly?");
  const [chatStatus, setChatStatus] = useState<"idle" | "sending" | "error">("idle");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (autoPauseArmed.current) {
        setIsPlaying(false);
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setSimDays((current) => current + delta * timeScale);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, timeScale]);

  const selectedBody = useMemo(() => {
    return solarBodies.find((body) => body.id === selectedId) || solarBodies[3];
  }, [selectedId]);
  const physics = useMemo(() => calculateEarthPhysics(earth), [earth]);
  const relativity = useMemo(() => calculateRelativity(blackHole), [blackHole]);

  const updateEarth = (patch: Partial<EditedEarthState>) => {
    setEarth((current) => {
      const next = { ...current, ...patch };
      if (next.constantDensity && patch.radiusKm !== undefined) {
        next.massKg = densityMassKg(next.radiusKm, solarBodies.find((body) => body.id === "earth")!.densityKgM3);
      }
      return next;
    });
  };

  const sendChat = async (prompt = chatInput) => {
    const question = prompt.trim();
    if (!question || chatStatus === "sending") return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setChatInput("");
    setChatStatus("sending");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          sceneContext: {
            selectedBody: selectedBody.name,
            mode,
            earth,
            blackHole,
            physics,
            relativity
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tutor request failed.");
      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
      setChatStatus("idle");
    } catch (err) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "Tutor is unavailable. Check your .env LLM_API_KEY and restart the server."
        }
      ]);
      setChatStatus("error");
    }
  };

  return (
    <main className="app-shell">
      <AstrophysicaScene
        bodies={solarBodies}
        selectedId={selectedId}
        mode={mode}
        simDays={simDays}
        isPlaying={isPlaying}
        scaleMode={scaleMode}
        showLabels={showLabels}
        showVectors={showVectors}
        powerSave={powerSave}
        earth={earth}
        blackHole={blackHole}
        onSelectBody={setSelectedId}
      />

      <header className="topbar">
        <div className="brand-mark"><Sparkles size={18} /> Astrophysica Playground</div>
        <div className="mode-switch" aria-label="Scene mode">
          <button className={mode === "solar" ? "active" : ""} onClick={() => setMode("solar")}>
            <Orbit size={16} /> Solar System
          </button>
          <button className={mode === "black-hole" ? "active" : ""} onClick={() => setMode("black-hole")}>
            <Atom size={16} /> Black Hole Lab
          </button>
        </div>
      </header>

      <section className="panel left-panel">
        <PanelHeader icon={<Telescope size={18} />} title="Mission Control" />
        <div className="button-row">
          <IconButton
            label={isPlaying ? "Pause time" : "Play time"}
            onClick={() => {
              autoPauseArmed.current = false;
              setIsPlaying((value) => !value);
            }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </IconButton>
          <IconButton label="Reverse time direction" onClick={() => setTimeScale((value) => -value)}>
            <RotateCcw size={18} />
          </IconButton>
          <IconButton label="Jump to current epoch" onClick={() => setSimDays(0)}>
            <RefreshCcw size={18} />
          </IconButton>
        </div>
        <Range
          label="Simulation speed"
          value={timeScale}
          min={-365}
          max={365}
          step={1}
          display={`${formatNumber(timeScale)} days/sec`}
          onChange={(value) => setTimeScale(value)}
        />
        <div className="segmented">
          {SCALE_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={scaleMode === option.id ? "active" : ""}
              onClick={() => setScaleMode(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
        <label className="check-line">
          <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
          Planet labels
        </label>
        <label className="check-line">
          <input type="checkbox" checked={showVectors} onChange={(event) => setShowVectors(event.target.checked)} />
          Velocity arrows
        </label>
        <label className="check-line">
          <input type="checkbox" checked={powerSave} onChange={(event) => setPowerSave(event.target.checked)} />
          Power saver rendering
        </label>

        <div className="planet-grid">
          {solarBodies.map((body) => (
            <button
              key={body.id}
              className={selectedId === body.id ? "selected" : ""}
              onClick={() => {
                setSelectedId(body.id);
                setMode("solar");
              }}
            >
              <span style={{ background: body.color }} />
              {body.name}
            </button>
          ))}
        </div>
      </section>

      <section className="panel right-panel">
        <PanelHeader icon={<Gauge size={18} />} title={mode === "solar" ? "Selected Body" : "Relativity Readout"} />
        {mode === "solar" ? (
          <BodyInspector body={selectedBody} earth={earth} simDays={simDays} />
        ) : (
          <RelativityInspector blackHole={blackHole} relativity={relativity} />
        )}
      </section>

      <section className="panel physics-panel">
        <PanelHeader icon={<Zap size={18} />} title="Physics Playground" />
        {mode === "solar" ? (
          <EarthEditor earth={earth} physics={physics} updateEarth={updateEarth} />
        ) : (
          <BlackHoleEditor blackHole={blackHole} setBlackHole={setBlackHole} />
        )}
      </section>

      <section className="panel tutor-panel">
        <PanelHeader icon={<MessageSquareText size={18} />} title="Study Tutor" />
        <div className="prompt-row">
          {practicePrompts.slice(0, 6).map((prompt) => (
            <button key={prompt} onClick={() => sendChat(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
        <div className="chat-log">
          {messages.slice(-6).map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
              {message.content}
            </div>
          ))}
        </div>
        <form
          className="chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            void sendChat();
          }}
        >
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Ask about tensors, redshift, Neptune, or edited Earth..."
          />
          <button disabled={chatStatus === "sending"} title="Send question">
            <Send size={17} />
          </button>
        </form>
      </section>

      <section className="lesson-strip">
        {guidedLessons.map((lesson) => (
          <article key={lesson.title}>
            <strong>{lesson.title}</strong>
            <span>{lesson.focus}</span>
          </article>
        ))}
      </section>
    </main>
  );
}

function BodyInspector({ body, earth, simDays }: { body: SolarBody; earth: EditedEarthState; simDays: number }) {
  const displayBody =
    body.id === "earth"
      ? { ...body, radiusKm: earth.radiusKm, massKg: earth.massKg, semiMajorAxisAu: earth.orbitalDistanceAu, orbitalSpeedKmS: earth.orbitalSpeedKmS }
      : body;
  const distanceFromEarthKm = distanceFromEarth(displayBody, earth, simDays);
  const earthRotationHours = Math.abs(solarBodies.find((item) => item.id === "earth")!.rotationPeriodHours);
  const bodyRotationHours = Math.abs(displayBody.rotationPeriodHours);
  const rotationDirection = displayBody.rotationPeriodHours < 0 ? "retrograde" : "prograde";
  const massVsEarth = displayBody.massKg / earth.massKg;
  const radiusVsEarth = displayBody.radiusKm / earth.radiusKm;

  return (
    <div className="readout-list">
      <h2>{displayBody.name}</h2>
      <p>{displayBody.overview}</p>
      <Readout label="Mass" value={`${displayScientific(displayBody.massKg)} kg`} />
      <Readout label="Mass vs Earth" value={`${formatNumber(massVsEarth, massVsEarth < 0.01 ? 4 : 3)} x`} />
      <Readout label="Radius" value={`${formatNumber(displayBody.radiusKm)} km`} />
      <Readout label="Radius vs Earth" value={`${formatNumber(radiusVsEarth, radiusVsEarth < 0.01 ? 4 : 3)} x`} />
      <Readout label="Distance from Earth" value={formatDistance(distanceFromEarthKm)} />
      <Readout label="Orbital distance" value={`${formatNumber(displayBody.semiMajorAxisAu, 3)} AU`} />
      <Readout label="Orbital speed" value={`${formatNumber(displayBody.orbitalSpeedKmS, 2)} km/s`} />
      <Readout label="Orbital period" value={`${formatNumber(displayBody.orbitalPeriodDays)} days`} />
      <Readout label="One rotation" value={`${formatRotation(bodyRotationHours)} (${formatNumber(bodyRotationHours / earthRotationHours, 2)} Earth days)`} />
      <Readout label="Rotation direction" value={rotationDirection} />
      <Readout label="Surface gravity" value={`${formatNumber(surfaceGravity(displayBody.massKg, displayBody.radiusKm), 2)} m/s^2`} />
      <Readout label="Escape velocity" value={`${formatNumber(escapeVelocityKmS(displayBody.massKg, displayBody.radiusKm), 2)} km/s`} />
      <Readout label="Eccentricity" value={formatNumber(displayBody.eccentricity, 4)} />
      <Readout label="Axial tilt" value={`${formatNumber(displayBody.axialTiltDeg, 2)} deg`} />
    </div>
  );
}

function RelativityInspector({
  blackHole,
  relativity
}: {
  blackHole: BlackHoleState;
  relativity: ReturnType<typeof calculateRelativity>;
}) {
  return (
    <div className="readout-list">
      <h2>{formatNumber(blackHole.massSolar, 1)} solar-mass black hole</h2>
      <p>Schwarzschild approximation for a non-spinning black hole. Values update live as you change mass, radius, and ship speed.</p>
      <Readout label="Schwarzschild radius" value={`${formatNumber(relativity.schwarzschildRadiusKm, 2)} km`} />
      <Readout label="Photon sphere" value={`${formatNumber(relativity.photonSphereKm, 2)} km`} />
      <Readout label="ISCO" value={`${formatNumber(relativity.iscoKm, 2)} km`} />
      <Readout label="Observer radius" value={`${formatNumber(relativity.observationRadiusKm, 2)} km`} />
      <Readout label="Light impact parameter" value={`${formatNumber(relativity.lightImpactParameterKm, 2)} km`} />
      <Readout label="Light deflection alpha" value={`${formatNumber(relativity.lightDeflectionDeg, 3)} deg`} />
      <Readout label="Deflection arcsec" value={`${formatNumber(relativity.lightDeflectionArcsec, 0)} arcsec`} />
      <Readout label="Time rate d_tau/dt" value={formatNumber(relativity.timeDilationFactor, 5)} />
      <Readout label="Redshift z" value={Number.isFinite(relativity.redshiftZ) ? formatNumber(relativity.redshiftZ, 4) : "infinite"} />
      <Readout label="Outside travel" value={`${formatNumber(relativity.outsideTravelDays, 3)} days`} />
      <Readout label="Ship proper time" value={`${formatNumber(relativity.shipProperTravelDays, 3)} days`} />
      <Readout label="Length contraction" value={`${formatNumber(relativity.lengthContractionFactor, 4)} x`} />
      {relativity.warning ? <div className="warning">{relativity.warning}</div> : null}
    </div>
  );
}

function EarthEditor({
  earth,
  physics,
  updateEarth
}: {
  earth: EditedEarthState;
  physics: ReturnType<typeof calculateEarthPhysics>;
  updateEarth: (patch: Partial<EditedEarthState>) => void;
}) {
  return (
    <div className="editor-grid">
      <Range label="Earth radius" value={earth.radiusKm} min={2_000} max={16_000} step={10} display={`${formatNumber(earth.radiusKm)} km`} onChange={(value) => updateEarth({ radiusKm: value })} />
      <Range label="Earth mass" value={earth.massKg / 5.9722e24} min={0.1} max={8} step={0.01} display={`${formatNumber(earth.massKg / 5.9722e24, 2)} Earth masses`} onChange={(value) => updateEarth({ massKg: value * 5.9722e24 })} />
      <Range label="Orbital distance" value={earth.orbitalDistanceAu} min={0.35} max={3.2} step={0.01} display={`${formatNumber(earth.orbitalDistanceAu, 2)} AU`} onChange={(value) => updateEarth({ orbitalDistanceAu: value })} />
      <Range label="Orbital speed" value={earth.orbitalSpeedKmS} min={12} max={55} step={0.1} display={`${formatNumber(earth.orbitalSpeedKmS, 1)} km/s`} onChange={(value) => updateEarth({ orbitalSpeedKmS: value })} />
      <label className="check-line wide">
        <input type="checkbox" checked={earth.constantDensity} onChange={(event) => updateEarth({ constantDensity: event.target.checked })} />
        Constant density lock
      </label>
      <button className="reset-button" onClick={() => updateEarth(earthDefaults)}>Reset Earth</button>
      <div className={`stability ${physics.stability}`}>{physics.stabilityMessage}</div>
      <Readout label="Surface gravity" value={`${formatNumber(physics.surfaceGravityMs2, 2)} m/s^2`} />
      <Readout label="Escape velocity" value={`${formatNumber(physics.escapeVelocityKmS, 2)} km/s`} />
      <Readout label="Circular speed needed" value={`${formatNumber(physics.circularOrbitalSpeedKmS, 2)} km/s`} />
      <Readout label="Orbit period estimate" value={`${formatNumber(physics.orbitalPeriodDays, 1)} days`} />
      <Readout label="Sun-Earth force" value={`${displayScientific(physics.sunEarthForceN)} N`} />
      <Readout label="Kinetic energy" value={`${displayScientific(physics.kineticEnergyJ)} J`} />
      <Readout label="Potential energy" value={`${displayScientific(physics.potentialEnergyJ)} J`} />
      <Readout label="Radius delta" value={`${formatNumber(earthRadiusDeltaPercent(earth.radiusKm), 1)}%`} />
      <Readout label="Mass delta" value={`${formatNumber(earthMassDeltaPercent(earth.massKg), 1)}%`} />
      <div className="formula-card wide">
        <strong>Newtonian laws in this sandbox</strong>
        <span>F = G m1 m2 / r^2; g = GM / R^2; v_circular = sqrt(GM / r); v_escape = sqrt(2GM / R); T = 2 pi sqrt(a^3 / GM); KE = 1/2 mv^2; U = -GMm / r.</span>
      </div>
    </div>
  );
}

function BlackHoleEditor({
  blackHole,
  setBlackHole
}: {
  blackHole: BlackHoleState;
  setBlackHole: (value: BlackHoleState) => void;
}) {
  const update = (patch: Partial<BlackHoleState>) => setBlackHole({ ...blackHole, ...patch });
  return (
    <div className="editor-grid">
      <Range label="Black-hole mass" value={blackHole.massSolar} min={1} max={4_300_000} step={1} display={`${formatNumber(blackHole.massSolar)} solar masses`} onChange={(value) => update({ massSolar: value })} />
      <Range label="Ship speed" value={blackHole.shipSpeedFractionC} min={0.01} max={0.98} step={0.01} display={`${formatNumber(blackHole.shipSpeedFractionC, 2)} c`} onChange={(value) => update({ shipSpeedFractionC: value })} />
      <Range label="Observer radius" value={blackHole.observationRadiusMultiplier} min={1.01} max={12} step={0.01} display={`${formatNumber(blackHole.observationRadiusMultiplier, 2)} Rs`} onChange={(value) => update({ observationRadiusMultiplier: value })} />
      <Range label="Light impact parameter" value={blackHole.lightImpactMultiplier} min={2.2} max={60} step={0.1} display={`${formatNumber(blackHole.lightImpactMultiplier, 1)} Rs`} onChange={(value) => update({ lightImpactMultiplier: value })} />
      <Range label="Launch distance" value={blackHole.launchDistanceAu} min={0.05} max={30} step={0.05} display={`${formatNumber(blackHole.launchDistanceAu, 2)} AU`} onChange={(value) => update({ launchDistanceAu: value })} />
      <button className="reset-button wide" onClick={() => setBlackHole(defaultBlackHole)}>Reset black-hole lab</button>
      <div className="formula-card wide">
        <strong>Relativity laws in this lab</strong>
        <span>Rs = 2GM / c^2; photon sphere = 1.5 Rs; ISCO = 3 Rs; weak light deflection alpha ~= 4GM / (c^2 b); d_tau/dt = sqrt(1 - Rs / r); z = 1/(d_tau/dt) - 1; gamma = 1/sqrt(1 - v^2/c^2).</span>
      </div>
    </div>
  );
}

function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="panel-header">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="icon-button" onClick={onClick} title={label} aria-label={label}>
      {children}
    </button>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-line">
      <span>
        {label}
        <strong>{display}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function displayScientific(value: number) {
  return value.toExponential(3).replace("e+", "e");
}

function distanceFromEarth(body: SolarBody, earth: EditedEarthState, simDays: number) {
  if (body.id === "earth") return 0;
  const earthBody = solarBodies.find((item) => item.id === "earth")!;
  const earthDisplay = {
    ...earthBody,
    massKg: earth.massKg,
    radiusKm: earth.radiusKm,
    semiMajorAxisAu: earth.orbitalDistanceAu,
    orbitalSpeedKmS: earth.orbitalSpeedKmS
  };
  const bodyPosition = approximateOrbitPositionAu(body, simDays);
  const earthPosition = approximateOrbitPositionAu(earthDisplay, simDays);
  const dx = bodyPosition.x - earthPosition.x;
  const dy = bodyPosition.y - earthPosition.y;
  const dz = bodyPosition.z - earthPosition.z;
  return Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2) * AU_KM;
}

function approximateOrbitPositionAu(body: SolarBody, simDays: number) {
  if (body.id === "sun" || body.orbitalPeriodDays === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const planetIndex = Math.max(0, solarBodies.filter((item) => item.id !== "sun").findIndex((item) => item.id === body.id));
  const angle = (simDays / body.orbitalPeriodDays) * Math.PI * 2 + planetIndex * 0.72;
  const e = body.eccentricity;
  return {
    x: body.semiMajorAxisAu * (Math.cos(angle) - e * 0.4),
    y: Math.sin(body.inclinationDeg * (Math.PI / 180)) * Math.sin(angle) * 0.03,
    z: body.semiMajorAxisAu * Math.sqrt(Math.max(0.05, 1 - e ** 2)) * Math.sin(angle)
  };
}

function formatDistance(distanceKm: number) {
  if (distanceKm === 0) return "0 km";
  if (distanceKm < 1_000_000) return `${formatNumber(distanceKm)} km`;
  return `${formatNumber(distanceKm / 1_000_000, 2)} million km (${formatNumber(distanceKm / AU_KM, 3)} AU)`;
}

function formatRotation(hours: number) {
  if (hours < 48) return `${formatNumber(hours, 2)} hours`;
  return `${formatNumber(hours / 24, 2)} days`;
}
