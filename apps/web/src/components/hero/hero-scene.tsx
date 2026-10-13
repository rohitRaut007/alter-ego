import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { NODES, PALETTE, STAGE, type NodeSpec } from "./scene-config";
import { useLanguage } from "@/lib/i18n";

function easeOut(t: number) {
  return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
}

function stageProgress(elapsed: number, start: number, duration: number) {
  return easeOut((elapsed - start) / duration);
}

/* ------------------------------------------------------------------ core */

function Core({ engagement, reduced }: { engagement: React.RefObject<number>; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const shellMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const glow = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    const appear = stageProgress(t, STAGE.core, 1.1);
    const e = engagement.current ?? 0;

    const target = appear * (1 + e * 0.16);
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 6, delta));
    g.visible = appear > 0.001;

    if (!reduced) {
      g.rotation.y += delta * (0.16 + e * 0.5);
      g.rotation.x = Math.sin(t * 0.32) * 0.14;
      if (inner.current) {
        inner.current.rotation.y -= delta * (0.34 + e * 0.7);
        inner.current.rotation.z = Math.cos(t * 0.5) * 0.2;
        const pulse = 1 + Math.sin(t * 1.6) * 0.035;
        inner.current.scale.setScalar(pulse);
      }
    }
    if (shellMat.current) {
      shellMat.current.emissiveIntensity = THREE.MathUtils.damp(
        shellMat.current.emissiveIntensity,
        0.25 + e * 1.1,
        5,
        delta,
      );
    }
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.damp(m.opacity, 0.07 + e * 0.16, 5, delta);
      glow.current.scale.setScalar(1 + Math.sin(t * 0.9) * 0.03 + e * 0.12);
    }
  });

  return (
    <group ref={group} scale={0}>
      {/* seven nested layer rings */}
      {NODES.map((n, i) => (
        <mesh
          key={n.id}
          rotation={[Math.PI / 2 + i * 0.19, i * 0.42, i * 0.13]}
          scale={1 - i * 0.055}
        >
          <torusGeometry args={[0.95, 0.008, 8, 128]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? PALETTE.bronze : PALETTE.ink}
            transparent
            opacity={0.55 - i * 0.035}
            roughness={0.35}
            metalness={0.6}
          />
        </mesh>
      ))}

      {/* faceted glass shell */}
      <mesh>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshPhysicalMaterial
          ref={shellMat}
          color={PALETTE.paper}
          emissive={PALETTE.bronzeLight}
          emissiveIntensity={0.25}
          transmission={0.85}
          thickness={0.9}
          roughness={0.18}
          metalness={0.1}
          clearcoat={1}
          transparent
          opacity={0.75}
          ior={1.35}
        />
      </mesh>

      {/* evolving inner solid */}
      <mesh ref={inner}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial
          color={PALETTE.bronze}
          emissive={PALETTE.bronze}
          emissiveIntensity={0.45}
          roughness={0.25}
          metalness={0.85}
          flatShading
        />
      </mesh>

      {/* volumetric halo */}
      <mesh ref={glow} scale={1}>
        <sphereGeometry args={[1.45, 32, 32]} />
        <meshBasicMaterial
          color={PALETTE.bronzeLight}
          transparent
          opacity={0.07}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------------- nodes */

function OrbitNode({
  spec,
  index,
  cursor,
  reduced,
  onPos,
}: {
  spec: NodeSpec;
  index: number;
  cursor: React.RefObject<THREE.Vector3>;
  reduced: boolean;
  onPos: (i: number, v: THREE.Vector3) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const proximity = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const { t } = useLanguage();

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const appear = stageProgress(t, STAGE.nodes + index * 0.09, 0.8);

    const a = spec.phase + (reduced ? 0 : t * spec.speed);
    tmp.set(
      Math.cos(a) * spec.radius,
      Math.sin(a * 1.3) * spec.radius * spec.inclination + Math.sin(t * 0.5 + index) * 0.08,
      Math.sin(a) * spec.radius * 0.62,
    );

    // gravitational pull toward the cursor
    const c = cursor.current;
    if (c) {
      const d = tmp.distanceTo(c);
      const pull = Math.max(0, 1 - d / 3.2);
      proximity.current = THREE.MathUtils.damp(proximity.current, pull, 5, delta);
      tmp.lerp(c, proximity.current * 0.22);
    }

    g.position.lerp(tmp, 1 - Math.pow(0.001, delta));
    g.scale.setScalar(appear * (1 + proximity.current * 0.35 + (hovered ? 0.55 : 0)));
    onPos(index, g.position);

    if (mesh.current && !reduced) {
      mesh.current.rotation.x += delta * (0.4 + proximity.current);
      mesh.current.rotation.y += delta * (0.3 + proximity.current * 1.2);
      const m = mesh.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = THREE.MathUtils.damp(
        m.emissiveIntensity,
        0.15 + proximity.current * 0.9 + (hovered ? 0.8 : 0),
        6,
        delta,
      );
    }
  });

  return (
    <group ref={group}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[spec.size, spec.size, spec.size]} />
        <meshStandardMaterial
          color={PALETTE.ink}
          emissive={PALETTE.bronze}
          emissiveIntensity={0.15}
          roughness={0.28}
          metalness={0.75}
        />
      </mesh>
      {hovered && (
        <Html distanceFactor={9} position={[0, spec.size + 0.22, 0]} center zIndexRange={[20, 0]}>
          <div className="pointer-events-none w-40 rounded-xl border border-border/80 bg-card/85 px-3 py-2 text-center shadow-lift backdrop-blur-md">
            <p className="text-[11px] font-semibold tracking-tight text-foreground">{t(`hero_node_${spec.id}_label`, spec.label)}</p>
            <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{t(`hero_node_${spec.id}_detail`, spec.detail)}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ----------------------------------------------------------------- links */

interface LineRef {
  material: { opacity: number };
  geometry: { setPositions: (p: number[]) => void };
}

function Links({ positions }: { positions: THREE.Vector3[] }) {
  const refs = useRef<(LineRef | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    NODES.forEach((n, i) => {
      const line = refs.current[i];
      const p = positions[i];
      if (!line || !p) return;
      const appear = stageProgress(t, STAGE.links + i * 0.07, 0.7);
      const flicker = 0.35 + 0.35 * Math.sin(t * (0.7 + i * 0.23) + i);
      line.material.opacity = appear * Math.max(0.06, flicker) * 0.55;
      line.geometry.setPositions([0, 0, 0, p.x, p.y, p.z]);
    });
  });

  return (
    <>
      {NODES.map((n, i) => (
        <Line
          key={n.id}
          ref={(r: LineRef | null) => {
            refs.current[i] = r;
          }}
          points={[
            [0, 0, 0],
            [1, 0, 0],
          ]}
          color={PALETTE.bronze}
          lineWidth={1}
          transparent
          opacity={0}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------- particles */

function Particles({
  count,
  cursor,
  reduced,
}: {
  count: number;
  cursor: React.RefObject<THREE.Vector3>;
  reduced: boolean;
}) {
  const points = useRef<THREE.Points>(null);

  const { positions, base, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 4.2;
      base[i * 3] = Math.cos(theta) * r;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = Math.sin(theta) * r * 0.7;
      positions[i * 3] = base[i * 3]!;
      positions[i * 3 + 1] = base[i * 3 + 1]!;
      positions[i * 3 + 2] = base[i * 3 + 2]!;
    }
    return { positions, base, velocities };
  }, [count]);

  useFrame((state, delta) => {
    const p = points.current;
    if (!p) return;
    const t = state.clock.elapsedTime;
    const appear = stageProgress(t, STAGE.particles, 1.2);
    (p.material as THREE.PointsMaterial).opacity = appear * 0.55;
    if (reduced) return;

    const arr = (p.geometry.attributes["position"] as THREE.BufferAttribute).array as Float32Array;
    const c = cursor.current;
    const dt = Math.min(delta, 0.05);

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const px = arr[ix]!;
      const py = arr[ix + 1]!;
      const pz = arr[ix + 2]!;
      // drift back to the orbital base position
      const tx = base[ix]! + Math.sin(t * 0.25 + i) * 0.12;
      const ty = base[ix + 1]! + Math.cos(t * 0.3 + i * 0.5) * 0.14;
      const tz = base[ix + 2]! + Math.cos(t * 0.22 + i) * 0.12;

      let vx = velocities[ix]!;
      let vy = velocities[ix + 1]!;
      let vz = velocities[ix + 2]!;

      if (c) {
        const dx = c.x - px;
        const dy = c.y - py;
        const dz = c.z - pz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 9) {
          const f = (1 - d2 / 9) * 3.2;
          vx += dx * f * dt;
          vy += dy * f * dt;
          vz += dz * f * dt;
        }
      }
      vx = (vx + (tx - px) * 1.4 * dt) * 0.92;
      vy = (vy + (ty - py) * 1.4 * dt) * 0.92;
      vz = (vz + (tz - pz) * 1.4 * dt) * 0.92;
      velocities[ix] = vx;
      velocities[ix + 1] = vy;
      velocities[ix + 2] = vz;
      arr[ix] = px + vx;
      arr[ix + 1] = py + vy;
      arr[ix + 2] = pz + vz;
    }
    (p.geometry.attributes["position"] as THREE.BufferAttribute).needsUpdate = true;
    p.rotation.y = t * 0.012;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color={PALETTE.bronze}
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ------------------------------------------------------------- the world */

function Universe({
  reduced,
  isMobile,
  onEngagement,
}: {
  reduced: boolean;
  isMobile: boolean;
  onEngagement: (v: number) => void;
}) {
  const world = useRef<THREE.Group>(null);
  const cursor = useRef(new THREE.Vector3(0, 0, 0));
  const engagement = useRef(0);
  const scroll = useRef(0);
  const positions = useMemo(() => NODES.map(() => new THREE.Vector3()), []);
  const { camera } = useThree();
  const lastReport = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      scroll.current = Math.min(1, window.scrollY / (window.innerHeight || 800));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useFrame((state, delta) => {
    const { pointer, viewport } = state;
    // project the pointer onto the scene plane
    cursor.current.lerp(
      new THREE.Vector3((pointer.x * viewport.width) / 2, (pointer.y * viewport.height) / 2, 0.6),
      1 - Math.pow(0.0015, delta),
    );

    const distToCore = cursor.current.length();
    const e = Math.max(0, 1 - distToCore / 2.6);
    engagement.current = THREE.MathUtils.damp(engagement.current, e, 4, delta);

    if (Math.abs(engagement.current - lastReport.current) > 0.03) {
      lastReport.current = engagement.current;
      onEngagement(engagement.current);
    }

    if (world.current && !reduced) {
      world.current.rotation.y = THREE.MathUtils.damp(
        world.current.rotation.y,
        pointer.x * 0.32,
        3,
        delta,
      );
      world.current.rotation.x = THREE.MathUtils.damp(
        world.current.rotation.x,
        -pointer.y * 0.22,
        3,
        delta,
      );
      world.current.position.x = THREE.MathUtils.damp(
        world.current.position.x,
        pointer.x * 0.35,
        3,
        delta,
      );
      world.current.position.y = THREE.MathUtils.damp(
        world.current.position.y,
        pointer.y * 0.25,
        3,
        delta,
      );
    }

    const baseZ = isMobile ? 11.5 : 9.6;
    const targetZ = baseZ - scroll.current * 3.4 - engagement.current * 0.9;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 2.5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, scroll.current * 1.2, 2.5, delta);
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={world}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 6]} intensity={1.5} castShadow />
      <directionalLight position={[-6, -2, -4]} intensity={0.5} color={PALETTE.bronzeLight} />
      <pointLight position={[0, 0, 0]} intensity={2.2} distance={6} color={PALETTE.bronzeLight} />

      <Particles count={isMobile ? 260 : 780} cursor={cursor} reduced={reduced} />
      <Links positions={positions} />
      {NODES.map((spec, i) => (
        <OrbitNode
          key={spec.id}
          spec={spec}
          index={i}
          cursor={cursor}
          reduced={reduced}
          onPos={(idx, v) => positions[idx]?.copy(v)}
        />
      ))}
      <Core engagement={engagement} reduced={reduced} />
    </group>
  );
}

export default function HeroScene({ onEngagement }: { onEngagement: (v: number) => void }) {
  const [reduced, setReduced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mob = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setReduced(rm.matches);
      setIsMobile(mob.matches);
    };
    sync();
    rm.addEventListener("change", sync);
    mob.addEventListener("change", sync);
    return () => {
      rm.removeEventListener("change", sync);
      mob.removeEventListener("change", sync);
    };
  }, []);

  return (
    <Canvas
      dpr={[1, isMobile ? 1.5 : 2]}
      camera={{ position: [0, 0, isMobile ? 11.5 : 9.6], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <fog attach="fog" args={[PALETTE.paper, 9, 20]} />
      <Universe reduced={reduced} isMobile={isMobile} onEngagement={onEngagement} />
    </Canvas>
  );
}
