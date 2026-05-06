import { Html, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { ScaleMode } from "../../../shared/src/constants";
import { SCALE_OPTIONS } from "../../../shared/src/constants";
import { heliocentricPositionAu, orbitalPathAu, type Vector3Au } from "../../../shared/src/orbits";
import { naturalSatellites } from "../../../shared/src/solarSystem";
import type { BlackHoleState, EditedEarthState, SolarBody } from "../../../shared/src/types";

type SceneMode = "solar" | "black-hole";

type Props = {
  bodies: SolarBody[];
  selectedId: string;
  mode: SceneMode;
  simDays: number;
  isPlaying: boolean;
  scaleMode: ScaleMode;
  showLabels: boolean;
  showVectors: boolean;
  powerSave: boolean;
  earth: EditedEarthState;
  blackHole: BlackHoleState;
  focusToken: number;
  onSelectBody: (id: string) => void;
};

export function AstrophysicaScene(props: Props) {
  const [warmup, setWarmup] = useState(true);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setWarmup(false), props.powerSave ? 900 : 1600);
    return () => window.clearTimeout(timer);
  }, [props.powerSave]);

  return (
    <Canvas
      className="space-canvas"
      camera={{ position: [0, 50, 92], fov: 48, near: 0.1, far: 4000 }}
      gl={{ antialias: !props.powerSave, alpha: false, powerPreference: props.powerSave ? "low-power" : "high-performance" }}
      dpr={[1, props.powerSave ? 1 : 1.5]}
      frameloop={props.isPlaying || warmup ? "always" : "demand"}
    >
      <color attach="background" args={["#03050b"]} />
      <fog attach="fog" args={["#03050b", 120, 520]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={props.mode === "solar" ? 2800 : 180} color="#ffd9a0" />
      <directionalLight position={[18, 26, 16]} intensity={1.5} color="#dbe9ff" />
      <Stars radius={320} depth={100} count={props.powerSave ? 550 : 1800} factor={4} fade speed={props.isPlaying && !props.powerSave ? 0.18 : 0} />
      <DemandRenderPulse
        depsKey={`${props.mode}:${props.selectedId}:${props.scaleMode}:${props.showLabels}:${props.showVectors}:${props.isPlaying}:${props.powerSave}:${Math.round(props.simDays * 10)}`}
        pulses={props.powerSave ? 4 : 8}
      />
      <SceneContents {...props} />
      <SceneCameraFocus {...props} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={460}
        makeDefault
      />
    </Canvas>
  );
}

function DemandRenderPulse({ depsKey, pulses }: { depsKey: string; pulses: number }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let frame = 0;
    let count = 0;
    const pulse = () => {
      invalidate();
      count += 1;
      if (count < pulses) {
        frame = requestAnimationFrame(pulse);
      }
    };
    pulse();
    return () => cancelAnimationFrame(frame);
  }, [depsKey, invalidate, pulses]);

  return null;
}

function SceneContents(props: Props) {
  return props.mode === "solar" ? <SolarSystem {...props} /> : <BlackHoleLab {...props} />;
}

function SceneCameraFocus({
  bodies,
  selectedId,
  mode,
  simDays,
  scaleMode,
  earth,
  focusToken,
  controlsRef
}: Props & { controlsRef: RefObject<any> }) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (mode === "black-hole") {
      const target = new THREE.Vector3(0, 2, 0);
      camera.position.set(0, 25, 58);
      camera.near = 0.03;
      camera.updateProjectionMatrix();
      if (controlsRef.current) {
        controlsRef.current.target.copy(target);
        controlsRef.current.update();
      }
      invalidate();
      return;
    }
    if (focusToken === 0) return;
    const scale = SCALE_OPTIONS.find((item) => item.id === scaleMode) || SCALE_OPTIONS[0];
    const body = bodies.find((item) => item.id === selectedId);
    if (!body) return;
    const displayBody = body.id === "earth" ? editedEarthBody(body, earth) : body;
    const target =
      body.id === "sun"
        ? new THREE.Vector3(0, 0, 0)
        : new THREE.Vector3(...displayOrbitPositionFromAu(heliocentricPositionAu(displayBody, simDays), displayBody, scale.distanceScale));
    const radius = body.id === "sun" ? 3.6 : visualRadius(displayBody);
    const distance = body.id === "sun" ? 24 : Math.max(6, radius * 9 + moonFocusRadius(displayBody) * 0.72);
    const offset = new THREE.Vector3(distance * 0.72, distance * 0.42, distance);
    camera.position.copy(target.clone().add(offset));
    camera.near = 0.03;
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
    invalidate();
  }, [bodies, camera, controlsRef, earth, focusToken, invalidate, mode, scaleMode, selectedId, simDays]);

  return null;
}

function SolarSystem({
  bodies,
  selectedId,
  simDays,
  scaleMode,
  showLabels,
  showVectors,
  powerSave,
  earth,
  onSelectBody
}: Props) {
  const scale = SCALE_OPTIONS.find((item) => item.id === scaleMode) || SCALE_OPTIONS[0];
  const planets = bodies.filter((body) => body.id !== "sun");
  const sun = bodies.find((body) => body.id === "sun");

  return (
    <group>
      <group>
        {sun ? (
          <PlanetMesh
            body={sun}
            position={[0, 0, 0]}
            radius={2.9}
            selected={selectedId === "sun"}
            showLabel={showLabels}
            powerSave={powerSave}
            simDays={simDays}
            onSelect={() => onSelectBody("sun")}
          />
        ) : null}
        <mesh>
          <sphereGeometry args={[4.3, powerSave ? 32 : 64, powerSave ? 32 : 64]} />
          <meshBasicMaterial color="#ffb24a" transparent opacity={0.13} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {planets.map((body) => {
        const displayBody =
          body.id === "earth"
            ? editedEarthBody(body, earth)
            : body;
        const orbitPath = orbitalPathAu(displayBody, simDays, powerSave ? 160 : 260).map((point) => displayOrbitPositionFromAu(point, displayBody, scale.distanceScale));
        const currentPosition = displayOrbitPositionFromAu(heliocentricPositionAu(displayBody, simDays), displayBody, scale.distanceScale);
        const nextPosition = displayOrbitPositionFromAu(heliocentricPositionAu(displayBody, simDays + 1), displayBody, scale.distanceScale);
        const radius = visualRadius(displayBody);
        const velocityVector = new THREE.Vector3(
          nextPosition[0] - currentPosition[0],
          nextPosition[1] - currentPosition[1],
          nextPosition[2] - currentPosition[2]
        )
          .normalize()
          .multiplyScalar(Math.max(1.5, body.orbitalSpeedKmS / 4.8));

        return (
          <group key={body.id}>
            <OrbitLine
              points={orbitPath}
              color={selectedId === body.id ? "#ffffff" : body.color}
              selected={selectedId === body.id}
            />
            <PlanetMesh
              body={displayBody}
              position={currentPosition}
              radius={radius}
              selected={selectedId === body.id}
              showLabel={showLabels}
              powerSave={powerSave}
              simDays={simDays}
              onSelect={() => onSelectBody(body.id)}
            />
            {showVectors ? (
              <VelocityVector
                start={[currentPosition[0], currentPosition[1] + radius + 0.18, currentPosition[2]]}
                vector={[velocityVector.x, velocityVector.y, velocityVector.z]}
                color={body.id === "earth" ? "#7df9ff" : "#a8ffcb"}
              />
            ) : null}
          </group>
        );
      })}
      <SolarPlaneGrid powerSave={powerSave} />
    </group>
  );
}

function BlackHoleLab({ blackHole, powerSave }: Props) {
  const impact = THREE.MathUtils.clamp(blackHole.lightImpactMultiplier, 2.2, 60);
  const lensStrength = THREE.MathUtils.clamp(2 / impact, 0.035, 0.72);

  return (
    <group position={[0, 2, 0]} scale={1.55}>
      <BlackHoleSystem3D strength={lensStrength} powerSave={powerSave} />
    </group>
  );
}

function BlackHoleSystem3D({ strength, powerSave }: { strength: number; powerSave: boolean }) {
  const diskRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (diskRef.current && !powerSave) diskRef.current.rotation.z += delta * 0.035;
  });

  const segments = powerSave ? 64 : 128;
  return (
    <group>
      <BlackHoleLightRays3D strength={strength} powerSave={powerSave} />
      <LensedBackArc3D radius={8.9} powerSave={powerSave} />
      <group ref={diskRef} rotation={[Math.PI / 2.72, 0.14, 0.04]}>
        <AccretionDisk3D radius={8.6} powerSave={powerSave} />
      </group>
      <mesh renderOrder={8}>
        <sphereGeometry args={[3.35, segments, segments]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh renderOrder={7}>
        <sphereGeometry args={[4.35, segments, segments]} />
        <meshBasicMaterial color="#020006" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh renderOrder={9}>
        <torusGeometry args={[3.78, 0.075, powerSave ? 10 : 16, segments]} />
        <meshBasicMaterial color="#fff1bd" transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh renderOrder={6}>
        <sphereGeometry args={[5.25, segments, segments]} />
        <meshBasicMaterial color="#ff733c" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function AccretionDisk3D({ radius, powerSave }: { radius: number; powerSave: boolean }) {
  const segments = powerSave ? 128 : 220;
  const hotFront = useMemo(
    () =>
      createArcRibbonGeometry({
        radius: radius * 0.95,
        thickness: 0.7,
        start: Math.PI * 1.02,
        end: Math.PI * 1.95,
        lift: 0,
        squash: 1,
        z: 0.06,
        segments: powerSave ? 56 : 112
      }),
    [radius, powerSave]
  );

  return (
    <group>
      <mesh>
        <ringGeometry args={[radius * 0.55, radius * 1.72, segments]} />
        <meshBasicMaterial color="#9d421c" transparent opacity={0.32} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[radius * 0.64, radius * 1.2, segments]} />
        <meshBasicMaterial color="#fff0a8" transparent opacity={0.56} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[radius * 1.05, radius * 1.85, segments]} />
        <meshBasicMaterial color="#ff5b24" transparent opacity={0.18} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh geometry={hotFront}>
        <meshBasicMaterial color="#fff6d2" transparent opacity={0.86} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function LensedBackArc3D({ radius, powerSave }: { radius: number; powerSave: boolean }) {
  const goldArc = useMemo(
    () =>
      createArcRibbonGeometry({
        radius,
        thickness: 0.62,
        start: Math.PI * 0.08,
        end: Math.PI * 0.92,
        lift: 2.25,
        squash: 0.24,
        z: -2.4,
        segments: powerSave ? 56 : 112
      }),
    [radius, powerSave]
  );
  const redArc = useMemo(
    () =>
      createArcRibbonGeometry({
        radius: radius * 0.88,
        thickness: 0.32,
        start: Math.PI * 0.13,
        end: Math.PI * 0.87,
        lift: 2.55,
        squash: 0.2,
        z: -2.25,
        segments: powerSave ? 48 : 96
      }),
    [radius, powerSave]
  );

  return (
    <group>
      <mesh geometry={goldArc}>
        <meshBasicMaterial color="#ffd176" transparent opacity={0.72} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh geometry={redArc}>
        <meshBasicMaterial color="#ff7244" transparent opacity={0.36} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BlackHoleLightRays3D({ strength, powerSave }: { strength: number; powerSave: boolean }) {
  const rays = useMemo(() => createBlackHoleRayCurves(strength, powerSave), [strength, powerSave]);
  return (
    <group>
      {rays.map((ray, index) => (
        <group key={ray.id}>
          <mesh geometry={ray.tube}>
            <meshBasicMaterial color={ray.color} transparent opacity={ray.opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <MovingPhoton curve={ray.curve} phase={index * 0.27} speed={ray.speed} powerSave={powerSave} />
        </group>
      ))}
    </group>
  );
}

function CinematicBlackHole({ strength, powerSave }: { strength: number; powerSave: boolean }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  const texture = useMemo(() => createBlackHoleTexture(strength, powerSave), [strength, powerSave]);

  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    if (group.current) group.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group}>
      <mesh renderOrder={8}>
        <planeGeometry args={[72, 42]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <CameraFacingLightRays strength={strength} powerSave={powerSave} />
    </group>
  );
}

function CameraFacingLightRays({ strength, powerSave }: { strength: number; powerSave: boolean }) {
  const rays = useMemo(() => createLensingRayCurves(strength, powerSave), [strength, powerSave]);

  return (
    <group renderOrder={14}>
      {rays.map((ray, index) => (
        <group key={ray.id}>
          <mesh renderOrder={14} geometry={ray.tube}>
            <meshBasicMaterial
              color={ray.color}
              transparent
              opacity={ray.opacity}
              blending={THREE.AdditiveBlending}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {ray.samples.map((sample, sampleIndex) => (
            <mesh key={sampleIndex} position={sample.position} scale={sample.scale} renderOrder={15}>
              <sphereGeometry args={[1, powerSave ? 8 : 12, powerSave ? 8 : 12]} />
              <meshBasicMaterial
                color={sample.color}
                transparent
                opacity={sample.opacity}
                blending={THREE.AdditiveBlending}
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
          <MovingPhoton curve={ray.curve} phase={index * 0.19} speed={ray.speed} powerSave={powerSave} />
        </group>
      ))}
    </group>
  );
}

function MovingPhoton({
  curve,
  phase,
  speed,
  powerSave
}: {
  curve: THREE.CatmullRomCurve3;
  phase: number;
  speed: number;
  powerSave: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime * speed + phase) % 1;
    const point = curve.getPoint(t);
    ref.current.position.copy(point);
    const distance = Math.max(0.001, Math.sqrt(point.x ** 2 + point.y ** 2));
    const redshift = THREE.MathUtils.clamp(1 - distance / 30, 0, 1);
    const scale = THREE.MathUtils.lerp(0.16, 0.36, redshift);
    ref.current.scale.setScalar(scale);
    if (material.current) {
      material.current.color.copy(new THREE.Color("#dff8ff").lerp(new THREE.Color("#ff6a36"), redshift * 0.9));
      material.current.opacity = THREE.MathUtils.lerp(0.72, 0.98, redshift);
    }
  });

  return (
    <mesh ref={ref} renderOrder={18}>
      <sphereGeometry args={[1, powerSave ? 12 : 18, powerSave ? 12 : 18]} />
      <meshBasicMaterial
        ref={material}
        color="#dff8ff"
        transparent
        opacity={0.86}
        blending={THREE.AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function PlanetMesh({
  body,
  position,
  radius,
  selected,
  showLabel,
  powerSave,
  simDays,
  onSelect
}: {
  body: SolarBody;
  position: [number, number, number];
  radius: number;
  selected: boolean;
  showLabel: boolean;
  powerSave: boolean;
  simDays: number;
  onSelect: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => createBodyTexture(body, powerSave), [body.id, body.color, powerSave]);
  const segments = powerSave ? 32 : 72;
  const atmosphereSegments = powerSave ? 24 : 48;
  useFrame((_, delta) => {
    if (mesh.current) {
      const direction = body.rotationPeriodHours < 0 ? -1 : 1;
      mesh.current.rotation.y += delta * direction * (body.id === "sun" ? 0.08 : 0.22);
    }
  });

  const isSun = body.id === "sun";
  return (
    <group position={position}>
      <mesh ref={mesh} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[radius, segments, segments]} />
        {isSun ? (
          <meshBasicMaterial map={texture} color="#ffd27c" />
        ) : (
          <meshStandardMaterial
            map={texture}
            color="#ffffff"
            roughness={0.72}
            metalness={0.02}
            emissive={selected ? body.color : "#000000"}
            emissiveIntensity={selected ? 0.16 : 0}
          />
        )}
      </mesh>
      {body.atmosphereColor ? (
        <mesh>
          <sphereGeometry args={[radius * 1.08, atmosphereSegments, atmosphereSegments]} />
          <meshBasicMaterial
            color={body.atmosphereColor}
            transparent
            opacity={isSun ? 0.18 : 0.18}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>
      ) : null}
      {body.id === "saturn" ? <SaturnRings radius={radius} powerSave={powerSave} /> : null}
      {selected ? <MoonSystem body={body} planetRadius={radius} simDays={simDays} powerSave={powerSave} showLabels={showLabel} /> : null}
      {selected ? (
        <mesh>
          <sphereGeometry args={[radius * 1.22, atmosphereSegments, atmosphereSegments]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.16} wireframe />
        </mesh>
      ) : null}
      {showLabel ? (
        <Html position={[0, radius + 0.55, 0]} center distanceFactor={20}>
          <button className="scene-label" onClick={onSelect}>{body.name}</button>
        </Html>
      ) : null}
    </group>
  );
}

function OrbitLine({
  points,
  color,
  selected
}: {
  points: [number, number, number][];
  color: string;
  selected: boolean;
}) {
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point))),
    [points]
  );
  const line = useMemo(() => {
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: selected ? 0.72 : 0.22
      })
    );
  }, [geometry, color, selected]);

  return <primitive object={line} />;
}

function VelocityVector({
  start,
  vector,
  color
}: {
  start: [number, number, number];
  vector: [number, number, number];
  color: string;
}) {
  const from = new THREE.Vector3(...start);
  const dir = new THREE.Vector3(...vector);
  const length = Math.max(1.5, dir.length() * 0.6);
  dir.normalize();
  return <arrowHelper args={[dir, from, length, color, length * 0.28, length * 0.16]} />;
}

function SaturnRings({ radius, powerSave }: { radius: number; powerSave: boolean }) {
  return (
    <mesh rotation={[Math.PI / 2.45, 0, 0]}>
      <ringGeometry args={[radius * 1.45, radius * 2.35, powerSave ? 56 : 96]} />
      <meshBasicMaterial color="#e9d6a6" transparent opacity={0.58} side={THREE.DoubleSide} />
    </mesh>
  );
}

function MoonSystem({
  body,
  planetRadius,
  simDays,
  powerSave,
  showLabels
}: {
  body: SolarBody;
  planetRadius: number;
  simDays: number;
  powerSave: boolean;
  showLabels: boolean;
}) {
  const moons = naturalSatellites.filter((moon) => moon.parentId === body.id).slice(0, powerSave ? 4 : 6);
  if (moons.length === 0) return null;

  return (
    <group rotation={[0.18, 0.1, 0.08]}>
      {moons.map((moon, index) => {
        const orbitRadius = moonDisplayRadius(body, planetRadius, moon.semiMajorAxisKm);
        const direction = moon.orbitalPeriodDays < 0 ? -1 : 1;
        const angle = direction * (simDays / Math.abs(moon.orbitalPeriodDays)) * Math.PI * 2 + index * 0.88;
        const moonRadius = THREE.MathUtils.clamp(
          Math.cbrt(moon.radiusKm / Math.max(1, body.radiusKm)) * planetRadius * 0.34,
          0.055,
          planetRadius * 0.24
        );
        const x = Math.cos(angle) * orbitRadius;
        const z = Math.sin(angle) * orbitRadius;

        return (
          <group key={moon.id}>
            <MoonOrbit radius={orbitRadius} color={moon.color} powerSave={powerSave} />
            <mesh position={[x, 0, z]}>
              <sphereGeometry args={[moonRadius, powerSave ? 10 : 16, powerSave ? 10 : 16]} />
              <meshStandardMaterial color={moon.color} roughness={0.78} emissive={moon.color} emissiveIntensity={0.04} />
            </mesh>
            {showLabels ? (
              <Html position={[x, moonRadius + 0.2, z]} center distanceFactor={14}>
                <span className="scene-label moon-label">{moon.name}</span>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function MoonOrbit({ radius, color, powerSave }: { radius: number; color: string; powerSave: boolean }) {
  const geometry = useMemo(() => {
    const points = Array.from({ length: powerSave ? 72 : 120 }, (_, index) => {
      const angle = (index / (powerSave ? 71 : 119)) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radius, powerSave]);

  return (
    <primitive
      object={
        new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.28
          })
        )
      }
    />
  );
}

function AccretionDisk({ radius, powerSave }: { radius: number; powerSave: boolean }) {
  const segments = powerSave ? 96 : 192;
  const hotArc = useMemo(
    () => createArcRibbonGeometry({
      radius: radius * 0.98,
      thickness: 0.58,
      start: Math.PI * 1.02,
      end: Math.PI * 1.86,
      lift: 0,
      squash: 1,
      z: 0.04,
      segments: powerSave ? 44 : 90
    }),
    [radius, powerSave]
  );
  const redArc = useMemo(
    () => createArcRibbonGeometry({
      radius: radius * 1.12,
      thickness: 0.44,
      start: Math.PI * 0.12,
      end: Math.PI * 0.86,
      lift: 0,
      squash: 1,
      z: 0.06,
      segments: powerSave ? 44 : 90
    }),
    [radius, powerSave]
  );

  return (
    <group rotation={[Math.PI / 2.62, 0.08, 0.04]}>
      <mesh>
        <ringGeometry args={[radius * 0.72, radius * 1.55, segments]} />
        <meshBasicMaterial color="#c5662e" transparent opacity={0.3} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[radius * 0.82, radius * 1.18, segments]} />
        <meshBasicMaterial color="#ffd074" transparent opacity={0.48} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[radius * 0.55, radius * 0.72, segments]} />
        <meshBasicMaterial color="#fff2bd" transparent opacity={0.24} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh geometry={hotArc}>
        <meshBasicMaterial color="#fff4cf" transparent opacity={0.82} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh geometry={redArc}>
        <meshBasicMaterial color="#ff4a2f" transparent opacity={0.34} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function LensedBackDisk({ radius, powerSave }: { radius: number; powerSave: boolean }) {
  const amberArc = useMemo(
    () => createArcRibbonGeometry({
      radius,
      thickness: 0.72,
      start: Math.PI * 0.07,
      end: Math.PI * 0.93,
      lift: 2.82,
      squash: 0.18,
      z: -2.55,
      segments: powerSave ? 48 : 96
    }),
    [radius, powerSave]
  );
  const redArc = useMemo(
    () => createArcRibbonGeometry({
      radius: radius * 0.92,
      thickness: 0.34,
      start: Math.PI * 0.1,
      end: Math.PI * 0.9,
      lift: 3.1,
      squash: 0.15,
      z: -2.35,
      segments: powerSave ? 48 : 96
    }),
    [radius, powerSave]
  );

  return (
    <group>
      <mesh geometry={amberArc}>
        <meshBasicMaterial color="#ffbf61" transparent opacity={0.72} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh geometry={redArc}>
        <meshBasicMaterial color="#ff5c36" transparent opacity={0.35} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 3.33, -2.55]} scale={[1.05, 0.12, 0.04]}>
        <torusGeometry args={[radius * 0.76, 0.04, 8, powerSave ? 64 : 120]} />
        <meshBasicMaterial color="#fff2bd" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BlackHoleShadow({ radius, powerSave }: { radius: number; powerSave: boolean }) {
  const segments = powerSave ? 48 : 96;
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius * 1.04, segments, segments]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.24, segments, segments]} />
        <meshBasicMaterial color="#05000a" transparent opacity={0.74} depthWrite={false} />
      </mesh>
      <mesh rotation={[0.08, 0, 0]}>
        <torusGeometry args={[radius * 1.16, 0.08, powerSave ? 12 : 18, powerSave ? 96 : 180]} />
        <meshBasicMaterial color="#ffe2a3" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[0.08, 0, 0]}>
        <torusGeometry args={[radius * 1.33, 0.035, powerSave ? 8 : 14, powerSave ? 96 : 180]} />
        <meshBasicMaterial color="#ff673d" transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BackgroundLensedStars({ radius, strength, powerSave }: { radius: number; strength: number; powerSave: boolean }) {
  const stars = useMemo(() => {
    const sourceAngles = powerSave ? [0.12, 0.32, 0.68, 0.88] : [0.08, 0.18, 0.32, 0.46, 0.62, 0.74, 0.88, 0.96];
    return sourceAngles.map((angle, index) => ({
      angle: angle * Math.PI * 2,
      radius: radius * (0.9 + (index % 3) * 0.09),
      size: 0.07 + (index % 2) * 0.045 + strength * 0.04,
      color: index % 3 === 0 ? "#fff2bd" : "#dff8ff"
    }));
  }, [radius, strength, powerSave]);

  return (
    <group position={[0, 0.35, -4.2]} rotation={[0.05, 0.16, 0]}>
      {stars.map((star, index) => (
        <mesh key={index} position={[Math.cos(star.angle) * star.radius, Math.sin(star.angle) * star.radius * 0.64, 0]}>
          <sphereGeometry args={[star.size, powerSave ? 8 : 14, powerSave ? 8 : 14]} />
          <meshBasicMaterial color={star.color} transparent opacity={0.46 + strength * 0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function EinsteinRing({ radius, strength, powerSave }: { radius: number; strength: number; powerSave: boolean }) {
  const segments = powerSave ? 96 : 180;
  return (
    <group position={[0, 0.1, -1.85]} rotation={[0.08, 0.22, 0]}>
      <mesh>
        <torusGeometry args={[radius, 0.055 + strength * 0.08, powerSave ? 10 : 18, segments]} />
        <meshBasicMaterial color="#dff8ff" transparent opacity={0.32 + strength * 0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh scale={[1.18, 1.18, 1]}>
        <torusGeometry args={[radius * 0.96, 0.025, 8, segments]} />
        <meshBasicMaterial color="#7df9ff" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh scale={[0.82, 0.82, 1]}>
        <torusGeometry args={[radius * 1.08, 0.02, 8, segments]} />
        <meshBasicMaterial color="#ff5c7a" transparent opacity={0.2 + strength * 0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function LensedStarImages({ radius, strength, powerSave }: { radius: number; strength: number; powerSave: boolean }) {
  const stars = useMemo(() => {
    const sourceAngles = powerSave ? [0.18, 0.62, 1.12, 1.64] : [0.18, 0.39, 0.62, 0.86, 1.12, 1.34, 1.64, 1.86];
    const angles = sourceAngles.map((item) => item * Math.PI);
    return angles.flatMap((angle, index) => {
      const mirror = angle + Math.PI;
      const size = 0.08 + (index % 3) * 0.035 + strength * 0.08;
      return [
        { angle, size, opacity: 0.42 + strength * 0.4, color: index % 2 ? "#fff0bd" : "#dff8ff" },
        { angle: mirror, size: size * 0.78, opacity: 0.22 + strength * 0.28, color: index % 2 ? "#ff9d7a" : "#7df9ff" }
      ];
    });
  }, [strength, powerSave]);

  return (
    <group position={[0, 0.1, -1.78]} rotation={[0.08, 0.22, 0]}>
      {stars.map((star, index) => (
        <mesh
          key={index}
          position={[
            Math.cos(star.angle) * radius * (1 + Math.sin(index) * 0.05),
            Math.sin(star.angle) * radius * (1 + Math.cos(index) * 0.05),
            0.04
          ]}
        >
          <sphereGeometry args={[star.size, powerSave ? 8 : 14, powerSave ? 8 : 14]} />
          <meshBasicMaterial color={star.color} transparent opacity={star.opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function LightBendingRays({ radius, strength, powerSave }: { radius: number; strength: number; powerSave: boolean }) {
  const rays = useMemo(() => {
    const bend = THREE.MathUtils.lerp(0.9, 3.4, strength);
    const pinch = THREE.MathUtils.lerp(1.72, 0.9, strength);
    const offsets = powerSave ? [-0.86, 0, 0.86] : [-1.15, -0.48, 0.48, 1.15];
    return offsets.map((offset, index) => {
      const points = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-18, 1.7 + offset, -4.8),
        new THREE.Vector3(-8.8, 1.85 + bend + offset * 0.32, -3.7),
        new THREE.Vector3(-radius * pinch, 2.25 + bend * 0.72 + offset * 0.2, -2.25),
        new THREE.Vector3(radius * pinch, 2.25 + bend * 0.72 - offset * 0.2, -2.25),
        new THREE.Vector3(8.8, 1.85 + bend - offset * 0.32, -3.7),
        new THREE.Vector3(18, 1.7 - offset, -4.8)
      ]).getPoints(powerSave ? 40 : 84);
      return new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: index % 2 ? "#dff8ff" : "#7df9ff",
          transparent: true,
          opacity: index % 2 ? 0.34 : 0.22
        })
      );
    });
  }, [radius, strength, powerSave]);

  return (
    <group>
      {rays.map((ray, index) => (
        <primitive key={index} object={ray} />
      ))}
    </group>
  );
}

function Photon({ beadIndex, color, powerSave }: { beadIndex: number; color: string; powerSave: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime * 0.22 + beadIndex * 0.26) % 1;
    const angle = THREE.MathUtils.lerp(Math.PI * 0.96, Math.PI * 0.04, t);
    const radius = 12.5 + Math.sin(t * Math.PI) * 2.8;
    ref.current.position.set(Math.cos(angle) * radius, 4.8 + Math.sin(angle) * 3.2, -2.1);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.18, powerSave ? 10 : 18, powerSave ? 10 : 18]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function RedshiftBeam({ from, to, powerSave }: { from: number; to: number; powerSave: boolean }) {
  const dotCount = powerSave ? 10 : 18;
  const dots = Array.from({ length: dotCount }, (_, index) => {
    const t = index / (dotCount - 1);
    const color = new THREE.Color("#7df9ff").lerp(new THREE.Color("#ff5c7a"), t);
    return {
      x: THREE.MathUtils.lerp(from, to, t),
      y: 2.35 + Math.sin(t * Math.PI * 2) * 0.18,
      color: `#${color.getHexString()}`,
      scale: THREE.MathUtils.lerp(0.13, 0.28, t)
    };
  });

  return (
    <group>
      {dots.map((dot, index) => (
        <mesh key={index} position={[dot.x, dot.y, 0]}>
          <sphereGeometry args={[dot.scale, powerSave ? 10 : 18, powerSave ? 10 : 18]} />
          <meshBasicMaterial color={dot.color} transparent opacity={0.84} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function ClockPair({ timeFactor, powerSave }: { timeFactor: number; powerSave: boolean }) {
  const nearHand = useRef<THREE.Mesh>(null);
  const farHand = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (nearHand.current) nearHand.current.rotation.z = -state.clock.elapsedTime * timeFactor;
    if (farHand.current) farHand.current.rotation.z = -state.clock.elapsedTime;
  });

  if (powerSave) return null;

  return (
    <group position={[-11, 4.4, -6]} rotation={[0.2, -0.4, 0]}>
      <ClockFace label="near clock" x={0} handRef={nearHand} color="#ff5c7a" />
      <ClockFace label="far clock" x={5.3} handRef={farHand} color="#7df9ff" />
    </group>
  );
}

function ClockFace({
  label,
  x,
  handRef,
  color
}: {
  label: string;
  x: number;
  handRef: React.RefObject<THREE.Mesh | null>;
  color: string;
}) {
  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <torusGeometry args={[0.82, 0.035, 12, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} />
      </mesh>
      <mesh ref={handRef} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.055, 0.74, 0.035]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Html position={[0, -1.15, 0]} center>
        <span className="scene-label">{label}</span>
      </Html>
    </group>
  );
}

function TiltedRing({
  radius,
  width,
  color,
  opacity,
  powerSave
}: {
  radius: number;
  width: number;
  color: string;
  opacity: number;
  powerSave: boolean;
}) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius, radius + width, powerSave ? 80 : 160]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function RelativisticShip({ x, speedFraction }: { x: number; speedFraction: number }) {
  const length = THREE.MathUtils.lerp(1.4, 0.45, Math.min(0.95, speedFraction));
  return (
    <group position={[x, 2.1, 0]} rotation={[0, 0, -0.18]}>
      <mesh scale={[length, 0.22, 0.22]}>
        <boxGeometry args={[2, 1, 1]} />
        <meshStandardMaterial color="#eaf8ff" emissive="#57e6ff" emissiveIntensity={0.45} roughness={0.28} />
      </mesh>
      <mesh position={[length + 0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.32, 0.95, 20]} />
        <meshStandardMaterial color="#ff5c7a" emissive="#ff2c5a" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function Worldline({ speedFraction, shipX }: { speedFraction: number; shipX: number }) {
  const points = useMemo(() => {
    const bend = THREE.MathUtils.lerp(0.5, 4.5, speedFraction);
    return Array.from({ length: 96 }, (_, index) => {
      const t = index / 95;
      return new THREE.Vector3(shipX * (1 - t), 2.05 + Math.sin(t * Math.PI) * bend, -8 + t * 8);
    });
  }, [speedFraction, shipX]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const line = useMemo(() => {
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: "#7df9ff", transparent: true, opacity: 0.72 })
    );
  }, [geometry]);
  return <primitive object={line} />;
}

function SolarPlaneGrid({ powerSave }: { powerSave: boolean }) {
  return (
    <gridHelper args={[680, powerSave ? 44 : 80, "#27395f", "#10192e"]} position={[0, -1.2, 0]}>
      <meshBasicMaterial transparent opacity={0.22} />
    </gridHelper>
  );
}

function SpacetimeGrid({ powerSave }: { powerSave: boolean }) {
  const lines = useMemo(() => {
    const collection: THREE.Vector3[][] = [];
    const limit = powerSave ? 8 : 12;
    for (let i = -limit; i <= limit; i += 1) {
      const row: THREE.Vector3[] = [];
      const col: THREE.Vector3[] = [];
      for (let j = -limit; j <= limit; j += 1) {
        row.push(curvePoint(i, j));
        col.push(curvePoint(j, i));
      }
      collection.push(row, col);
    }
    return collection;
  }, [powerSave]);

  return (
    <group position={[0, -2.4, 0]}>
      {lines.map((line, index) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(line);
        const material = new THREE.LineBasicMaterial({
          color: index % 2 ? "#29406d" : "#4566a0",
          transparent: true,
          opacity: 0.16
        });
        return <primitive key={index} object={new THREE.Line(geometry, material)} />;
      })}
    </group>
  );
}

function curvePoint(x: number, z: number) {
  const distance = Math.sqrt(x ** 2 + z ** 2);
  const depression = -6 / (distance + 1.4);
  return new THREE.Vector3(x * 1.8, depression, z * 1.8);
}

function createArcRibbonGeometry({
  radius,
  thickness,
  start,
  end,
  lift,
  squash,
  z,
  segments
}: {
  radius: number;
  thickness: number;
  start: number;
  end: number;
  lift: number;
  squash: number;
  z: number;
  segments: number;
}) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const angle = THREE.MathUtils.lerp(start, end, t);
    const wave = Math.sin(t * Math.PI);
    const outer = radius + thickness * 0.5;
    const inner = radius - thickness * 0.5;
    vertices.push(
      Math.cos(angle) * outer,
      lift + Math.sin(angle) * radius * squash + wave * 1.45,
      z + Math.cos(t * Math.PI) * 0.5,
      Math.cos(angle) * inner,
      lift + Math.sin(angle) * inner * squash + wave * 1.2,
      z + Math.cos(t * Math.PI) * 0.5
    );
    if (index < segments) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBlackHoleRayCurves(strength: number, powerSave: boolean) {
  const bend = THREE.MathUtils.lerp(1.5, 5.2, strength);
  const makeCurve = (id: string, y: number, z: number, color: string, opacity: number, speed: number) => {
    const sign = Math.sign(y) || 1;
    const near = sign * (5.2 + bend * 0.42);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-18, y, z),
      new THREE.Vector3(-10, y * 0.96, z * 0.7),
      new THREE.Vector3(-5.4, near, z * 0.35),
      new THREE.Vector3(0, near + sign * bend * 0.18, 0),
      new THREE.Vector3(5.4, near, -z * 0.35),
      new THREE.Vector3(10, y * 0.8, -z * 0.7),
      new THREE.Vector3(18, y * 0.52, -z)
    ]);
    return buildRayRenderData(id, curve, color, opacity, speed, powerSave ? 0.035 : 0.045, powerSave);
  };

  const skimPoints: THREE.Vector3[] = [new THREE.Vector3(-18, 3.7, 2.5), new THREE.Vector3(-10, 4.5, 1.4)];
  const radius = THREE.MathUtils.lerp(5.9, 5.0, strength);
  for (let index = 0; index <= 32; index += 1) {
    const t = index / 32;
    const angle = THREE.MathUtils.lerp(Math.PI * 0.78, Math.PI * -0.24, t);
    skimPoints.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(t * Math.PI) * 1.8));
  }
  skimPoints.push(new THREE.Vector3(10, -4.1, -1.4), new THREE.Vector3(18, -2.4, -2.5));

  return [
    makeCurve("upper-ray", 7.2, 3.4, "#dff8ff", 0.42, 0.13),
    makeCurve("lower-ray", -6.4, -3.0, "#7df9ff", 0.3, 0.12),
    makeCurve("warm-ray", 4.9, -2.6, "#fff2bd", 0.55, 0.17),
    buildRayRenderData("photon-sphere-skim-3d", new THREE.CatmullRomCurve3(skimPoints), "#ffd176", 0.66, 0.11, powerSave ? 0.04 : 0.052, powerSave)
  ];
}

function createLensingRayCurves(strength: number, powerSave: boolean) {
  const bend = THREE.MathUtils.lerp(2.4, 9.4, strength);
  const pinch = THREE.MathUtils.lerp(9.8, 7.3, strength);
  const configs = [
    { id: "upper-wide", offset: 8.4, sign: 1, color: "#dff8ff", opacity: 0.48, speed: 0.18, radius: 0.035 },
    { id: "lower-wide", offset: -7.4, sign: -1, color: "#9ff6ff", opacity: 0.34, speed: 0.16, radius: 0.03 },
    { id: "upper-tight", offset: 2.6, sign: 1, color: "#fff2bd", opacity: 0.68, speed: 0.22, radius: 0.052 },
    { id: "lower-tight", offset: -2.2, sign: -1, color: "#ffbc73", opacity: 0.54, speed: 0.2, radius: 0.046 }
  ];

  const rays = configs.map((config) => {
    const nearY = config.sign * (pinch + bend * (Math.abs(config.offset) < 3 ? 0.38 : 0.16));
    const points = [
      new THREE.Vector3(-36, config.offset, 1.2),
      new THREE.Vector3(-22, config.offset * 0.95, 1.2),
      new THREE.Vector3(-12, nearY * 0.96, 1.2),
      new THREE.Vector3(-5.4, nearY + config.sign * bend * 0.22, 1.2),
      new THREE.Vector3(0, nearY + config.sign * bend * 0.28, 1.2),
      new THREE.Vector3(5.4, nearY + config.sign * bend * 0.18, 1.2),
      new THREE.Vector3(12, nearY * 0.9, 1.2),
      new THREE.Vector3(22, config.offset * 0.52, 1.2),
      new THREE.Vector3(36, config.offset * 0.28, 1.2)
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    return buildRayRenderData(config.id, curve, config.color, config.opacity, config.speed, config.radius, powerSave);
  });

  const captureCurve = createPhotonSphereSkimCurve(strength);
  rays.push(buildRayRenderData("photon-sphere-skim", captureCurve, "#fff4cf", 0.72, 0.13, 0.045, powerSave));
  return rays;
}

function createPhotonSphereSkimCurve(strength: number) {
  const points: THREE.Vector3[] = [
    new THREE.Vector3(-36, 3.8, 1.28),
    new THREE.Vector3(-22, 4.6, 1.28),
    new THREE.Vector3(-13, 6.4, 1.28)
  ];
  const radius = THREE.MathUtils.lerp(10.8, 8.5, strength);
  const start = Math.PI * 0.78;
  const end = Math.PI * -0.22;
  const segments = 30;
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const angle = THREE.MathUtils.lerp(start, end, t);
    const squeeze = 0.9 + Math.sin(t * Math.PI) * 0.08;
    points.push(new THREE.Vector3(Math.cos(angle) * radius * squeeze, Math.sin(angle) * radius, 1.28));
  }
  points.push(new THREE.Vector3(13, -5.2, 1.28), new THREE.Vector3(24, -3.1, 1.28), new THREE.Vector3(36, -1.6, 1.28));
  return new THREE.CatmullRomCurve3(points);
}

function buildRayRenderData(
  id: string,
  curve: THREE.CatmullRomCurve3,
  color: string,
  opacity: number,
  speed: number,
  radius: number,
  powerSave: boolean
) {
  const tube = new THREE.TubeGeometry(curve, powerSave ? 72 : 132, radius, powerSave ? 6 : 8, false);
  const sampleCount = powerSave ? 8 : 14;
  const nearColor = new THREE.Color("#ff6a36");
  const farColor = new THREE.Color(color);
  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const t = (index + 0.5) / sampleCount;
    const position = curve.getPoint(t);
    const distance = Math.max(0.001, Math.sqrt(position.x ** 2 + position.y ** 2));
    const redshift = THREE.MathUtils.clamp(1 - distance / 31, 0, 1);
    const size = THREE.MathUtils.lerp(0.12, 0.33, redshift) * (index % 3 === 0 ? 1.25 : 1);
    return {
      color: `#${farColor.clone().lerp(nearColor, redshift * 0.82).getHexString()}`,
      opacity: THREE.MathUtils.lerp(0.28, 0.82, redshift),
      position,
      scale: [size, size, size] as [number, number, number]
    };
  });

  return { id, color, curve, opacity, samples, speed, tube };
}

function createBlackHoleTexture(strength: number, powerSave: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = powerSave ? 1200 : 1800;
  canvas.height = powerSave ? 720 : 1080;
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const cx = width * 0.5;
  const cy = height * 0.52;
  const shadow = width * 0.115;
  const diskRx = width * 0.43;
  const diskRy = height * 0.052;
  const lensBoost = THREE.MathUtils.clamp(strength * 1.8, 0.08, 1);

  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  const backgroundGlow = ctx.createRadialGradient(cx, cy, shadow * 0.4, cx, cy, width * 0.45);
  backgroundGlow.addColorStop(0, "rgba(255, 147, 66, 0.16)");
  backgroundGlow.addColorStop(0.28, "rgba(100, 44, 24, 0.08)");
  backgroundGlow.addColorStop(0.78, "rgba(12, 80, 90, 0.05)");
  backgroundGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = backgroundGlow;
  ctx.fillRect(0, 0, width, height);

  drawBlackHoleStars(ctx, cx, cy, shadow, powerSave ? 52 : 135);

  ctx.globalCompositeOperation = "lighter";
  fillEllipseGradient(ctx, cx, cy + height * 0.025, diskRx * 1.08, diskRy * 1.55, -0.018, [
    [0, "rgba(255, 75, 28, 0)"],
    [0.15, "rgba(255, 105, 36, 0.24)"],
    [0.42, "rgba(255, 234, 166, 0.74)"],
    [0.58, "rgba(255, 255, 225, 0.98)"],
    [0.76, "rgba(255, 131, 45, 0.42)"],
    [1, "rgba(255, 50, 24, 0)"]
  ], 20);

  strokeEllipse(ctx, cx, cy + height * 0.025, diskRx * 1.08, diskRy * 1.62, -0.018, 0, Math.PI * 2, "rgba(255, 101, 38, 0.42)", height * 0.064, 0.72, 22);
  strokeEllipse(ctx, cx, cy + height * 0.024, diskRx * 0.74, diskRy * 0.82, -0.018, 0, Math.PI * 2, "rgba(255, 248, 207, 0.86)", height * 0.012, 0.92, 5);

  const ringCount = powerSave ? 22 : 46;
  for (let index = 0; index < ringCount; index += 1) {
    const t = index / (ringCount - 1);
    const jitter = (seededUnit(index + 17) - 0.5) * height * 0.015;
    const rx = diskRx * THREE.MathUtils.lerp(0.58, 1.08, t);
    const ry = diskRy * THREE.MathUtils.lerp(0.48, 1.3, t);
    const hue = THREE.MathUtils.lerp(42, 16, t);
    const alpha = THREE.MathUtils.lerp(0.38, 0.12, t);
    strokeEllipse(
      ctx,
      cx,
      cy + height * 0.028 + jitter,
      rx,
      ry,
      -0.018,
      Math.PI * 0.04,
      Math.PI * 0.96,
      `hsla(${hue}, 100%, ${THREE.MathUtils.lerp(76, 48, t)}%, ${alpha})`,
      THREE.MathUtils.lerp(height * 0.005, height * 0.011, seededUnit(index + 4)),
      1,
      0
    );
    strokeEllipse(
      ctx,
      cx,
      cy + height * 0.028 + jitter * 0.65,
      rx * 0.98,
      ry * 0.9,
      -0.018,
      Math.PI * 1.04,
      Math.PI * 1.96,
      `hsla(${hue + 6}, 100%, ${THREE.MathUtils.lerp(66, 36, t)}%, ${alpha * 0.42})`,
      THREE.MathUtils.lerp(height * 0.003, height * 0.007, seededUnit(index + 9)),
      1,
      0
    );
  }

  strokeEllipse(ctx, cx, cy - height * 0.01, shadow * 1.68, shadow * (1.58 + lensBoost * 0.25), 0, Math.PI * 1.03, Math.PI * 1.97, "rgba(255, 221, 145, 0.96)", height * 0.014, 1, 9);
  strokeEllipse(ctx, cx, cy - height * 0.004, shadow * 1.88, shadow * (1.78 + lensBoost * 0.36), 0, Math.PI * 1.04, Math.PI * 1.96, "rgba(255, 112, 54, 0.58)", height * 0.018, 1, 14);
  strokeEllipse(ctx, cx, cy + height * 0.002, shadow * 2.08, shadow * (1.98 + lensBoost * 0.42), 0, Math.PI * 1.07, Math.PI * 1.93, "rgba(255, 247, 205, 0.36)", height * 0.006, 1, 2);
  strokeEllipse(ctx, cx, cy + shadow * 0.05, shadow * 1.34, shadow * 0.82, 0, Math.PI * 0.08, Math.PI * 0.92, "rgba(255, 238, 184, 0.62)", height * 0.01, 1, 4);
  strokeEllipse(ctx, cx, cy + shadow * 0.08, shadow * 1.55, shadow * 1.02, 0, Math.PI * 0.12, Math.PI * 0.88, "rgba(255, 116, 46, 0.34)", height * 0.014, 1, 10);

  for (let index = 0; index < (powerSave ? 32 : 72); index += 1) {
    const t = index / (powerSave ? 31 : 71);
    const side = t < 0.5 ? -1 : 1;
    const x = cx + side * diskRx * THREE.MathUtils.lerp(0.12, 0.95, Math.abs(t - 0.5) * 2);
    const y = cy + height * 0.028 + (seededUnit(index + 80) - 0.5) * diskRy * 1.1;
    const length = THREE.MathUtils.lerp(width * 0.012, width * 0.05, seededUnit(index + 120));
    ctx.save();
    ctx.globalAlpha = THREE.MathUtils.lerp(0.18, 0.64, seededUnit(index + 30));
    ctx.strokeStyle = side > 0 ? "rgba(255, 246, 199, 0.9)" : "rgba(255, 110, 52, 0.7)";
    ctx.lineWidth = THREE.MathUtils.lerp(1, 3.5, seededUnit(index + 60));
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - length * 0.5, y);
    ctx.lineTo(x + length * 0.5, y + (seededUnit(index + 90) - 0.5) * height * 0.006);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalCompositeOperation = "source-over";
  const shadowGlow = ctx.createRadialGradient(cx, cy, shadow * 0.82, cx, cy, shadow * 1.62);
  shadowGlow.addColorStop(0, "rgba(0, 0, 0, 1)");
  shadowGlow.addColorStop(0.72, "rgba(0, 0, 0, 0.96)");
  shadowGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadowGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, shadow * 1.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, shadow * 1.02, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "lighter";
  strokeEllipse(ctx, cx, cy, shadow * 1.07, shadow * 1.07, 0, 0, Math.PI * 2, "rgba(255, 243, 202, 0.96)", height * 0.008, 1, 5);
  strokeEllipse(ctx, cx, cy, shadow * 1.19, shadow * 1.19, 0, Math.PI * 1.04, Math.PI * 1.96, "rgba(255, 123, 52, 0.52)", height * 0.012, 1, 12);
  strokeEllipse(ctx, cx, cy, shadow * 1.23, shadow * 1.23, 0, Math.PI * 0.04, Math.PI * 0.96, "rgba(255, 231, 164, 0.28)", height * 0.01, 1, 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function fillEllipseGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  stops: Array<[number, string]>,
  blur: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(rx, ry);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${blur}px)`;
  const gradient = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - rx * 1.4, cy - ry * 4, rx * 2.8, ry * 8);
  ctx.restore();
}

function strokeEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  start: number,
  end: number,
  color: string,
  lineWidth: number,
  alpha: number,
  blur: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = blur ? `blur(${blur}px)` : "none";
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotation, start, end);
  ctx.stroke();
  ctx.restore();
}

function drawBlackHoleStars(ctx: CanvasRenderingContext2D, cx: number, cy: number, shadow: number, count: number) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < count; index += 1) {
    const x = seededUnit(index * 4 + 1) * width;
    const y = seededUnit(index * 4 + 2) * height;
    const dx = (x - cx) / shadow;
    const dy = (y - cy) / shadow;
    if (dx * dx + dy * dy < 2.6) continue;
    const size = 0.8 + seededUnit(index * 4 + 3) * 2.4;
    ctx.globalAlpha = 0.16 + seededUnit(index * 4 + 4) * 0.58;
    ctx.fillStyle = seededUnit(index + 11) > 0.74 ? "#ffd99a" : "#dceeff";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createBodyTexture(body: SolarBody, powerSave: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = powerSave ? 256 : 512;
  canvas.height = powerSave ? 128 : 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, lighten(body.color, 0.35));
  gradient.addColorStop(0.52, body.color);
  gradient.addColorStop(1, darken(body.color, 0.45));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (body.kind === "gas-giant" || body.kind === "ice-giant") {
    for (let y = 0; y < canvas.height; y += 18) {
      ctx.fillStyle = y % 36 === 0 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
      ctx.fillRect(0, y + Math.sin(y) * 4, canvas.width, 8 + (y % 4));
    }
  } else if (body.id === "earth") {
    ctx.fillStyle = "rgba(24, 170, 118, 0.82)";
    for (let i = 0; i < (powerSave ? 8 : 15); i += 1) {
      ctx.beginPath();
      const x = (i * 73) % canvas.width;
      const y = 36 + ((i * 41) % 170);
      ctx.ellipse(x, y, 22 + (i % 5) * 8, 10 + (i % 3) * 9, i * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.23)";
    for (let i = 0; i < (powerSave ? 12 : 28); i += 1) {
      ctx.beginPath();
      ctx.ellipse((i * 47) % canvas.width, (i * 29) % canvas.height, 30, 5, i, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (body.id === "sun") {
    for (let i = 0; i < (powerSave ? 45 : 120); i += 1) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.18)" : "rgba(255,80,0,0.18)";
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 4 + Math.random() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < (powerSave ? 24 : 55); i += 1) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.16)";
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 2 + Math.random() * 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = powerSave ? 2 : 8;
  return texture;
}

function visualRadius(body: SolarBody) {
  if (body.id === "sun") return 2.9;
  const earthScaled = Math.cbrt(body.radiusKm / 6_371);
  return THREE.MathUtils.clamp(earthScaled * 0.46, 0.22, 1.38);
}

function orbitScale(au: number, distanceScale: number) {
  return au <= 1.7 ? au * distanceScale * 2.4 : 4.5 + Math.sqrt(au) * distanceScale * 1.15;
}

function displayOrbitPositionFromAu(position: Vector3Au, body: SolarBody, distanceScale: number): [number, number, number] {
  if (body.semiMajorAxisAu <= 0) return [0, 0, 0];
  const factor = orbitScale(body.semiMajorAxisAu, distanceScale) / body.semiMajorAxisAu;
  return [position.x * factor, position.z * factor, position.y * factor];
}

function editedEarthBody(body: SolarBody, earth: EditedEarthState): SolarBody {
  return {
    ...body,
    massKg: earth.massKg,
    radiusKm: earth.radiusKm,
    semiMajorAxisAu: earth.orbitalDistanceAu,
    orbitalSpeedKmS: earth.orbitalSpeedKmS,
    orbitalPeriodDays: editedOrbitalPeriodDays(body, earth.orbitalDistanceAu)
  };
}

function editedOrbitalPeriodDays(body: SolarBody, semiMajorAxisAu: number) {
  if (!body.orbitalPeriodDays || !body.semiMajorAxisAu) return body.orbitalPeriodDays;
  return body.orbitalPeriodDays * Math.pow(semiMajorAxisAu / body.semiMajorAxisAu, 1.5);
}

function moonDisplayRadius(body: SolarBody, planetRadius: number, semiMajorAxisKm: number) {
  const ratio = semiMajorAxisKm / Math.max(1, body.radiusKm);
  return planetRadius * (2.2 + Math.sqrt(ratio) * 0.62);
}

function moonFocusRadius(body: SolarBody) {
  const largestMoonOrbit = Math.max(0, ...naturalSatellites.filter((moon) => moon.parentId === body.id).map((moon) => moon.semiMajorAxisKm));
  if (!largestMoonOrbit) return 0;
  return moonDisplayRadius(body, visualRadius(body), largestMoonOrbit);
}

function lighten(hex: string, amount: number) {
  return shiftColor(hex, amount);
}

function darken(hex: string, amount: number) {
  return shiftColor(hex, -amount);
}

function shiftColor(hex: string, amount: number) {
  const color = new THREE.Color(hex);
  color.r = THREE.MathUtils.clamp(color.r + amount, 0, 1);
  color.g = THREE.MathUtils.clamp(color.g + amount, 0, 1);
  color.b = THREE.MathUtils.clamp(color.b + amount, 0, 1);
  return `#${color.getHexString()}`;
}
