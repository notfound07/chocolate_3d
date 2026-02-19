import React, { Suspense, useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Joystick } from "react-joystick-component";

import "./App.css";
import roomGLB from "./assets/the_billiards_room.glb";
import chocolateGLB from "./assets/cadbury_dairy_milk_chocolate_piece.glb";
import ChocolateBar from "./assets/piece.png";
import Collect from "./assets/collect.mp3";
import Eat from "./assets/eat.mp3";

/* ---------- ROOM COMPONENT ---------- */
function RoomModel({ setBounds, setRoom }) {
  const { scene } = useGLTF(roomGLB);

  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    setBounds(box);
    setRoom(scene);
  }, [scene, setBounds, setRoom]);

  return <primitive object={scene} />;
}

/* ---------- CHOCOLATE COMPONENT ---------- */
function Chocolate({ position, room, onCollect, scale = 5, rotation = [20, 0, 0] }) {
  const { scene } = useGLTF(chocolateGLB);

  // Production-safe GLTF clone
  const gltfClone = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.emissive = new THREE.Color("#5a2c0a");
        child.material.emissiveIntensity = 2;
      }
    });
    return clone;
  }, [scene]);

  const ref = useRef();

  // Align on floor
  useEffect(() => {
    if (!room || !ref.current) return;

    const ray = new THREE.Raycaster(
      new THREE.Vector3(position[0], 20, position[2]),
      new THREE.Vector3(0, -1, 0)
    );

    const hits = room ? ray.intersectObject(room, true) : [];
    if (!hits.length) return;

    const hit = hits[hits.length - 1];
    ref.current.position.y = hit.point.y + 0.25;
  }, [room, position]);

  if (!gltfClone) return null;

  return (
    <primitive
      ref={ref}
      object={gltfClone}
      scale={scale}
      position={position}
      rotation={rotation}
      onPointerDown={(e) => {
        e.stopPropagation();
        onCollect();
      }}
    />
  );
}

/* ---------- PLAYER CAMERA COMPONENT ---------- */
function PlayerCamera({ bounds, moveRef, rotateRef, cameraRef }) {
  const { camera } = useThree();
  const groupRef = useRef();
  const rotXRef = useRef(0);
  const rotYRef = useRef(0);

  useEffect(() => {
    cameraRef.current = groupRef.current;
  }, [cameraRef]);

  useFrame(() => {
    if (!groupRef.current || !bounds) return;

    const g = groupRef.current;
    const speed = 1.5;

    const forward = new THREE.Vector3();
    g.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

    g.position.add(
      forward.clone().multiplyScalar(speed * (moveRef.current.f - moveRef.current.b))
    );
    g.position.add(
      right.clone().multiplyScalar(speed * (moveRef.current.r - moveRef.current.l))
    );
    g.position.y += speed * (moveRef.current.u - moveRef.current.d);

    g.position.x = THREE.MathUtils.clamp(g.position.x, bounds.min.x, bounds.max.x);
    g.position.y = THREE.MathUtils.clamp(g.position.y, bounds.min.y + 1, bounds.max.y - 0.2);
    g.position.z = THREE.MathUtils.clamp(g.position.z, bounds.min.z, bounds.max.z);

    rotYRef.current -= rotateRef.current.x;
    rotXRef.current -= rotateRef.current.y;
    rotXRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotXRef.current));
    g.rotation.y = rotYRef.current;
    g.rotation.x = rotXRef.current;
  });

  return (
    <group ref={groupRef}>
      <primitive object={camera} />
    </group>
  );
}

/* ---------- MAIN APP ---------- */
export default function App() {
  const [bounds, setBounds] = useState(null);
  const [room, setRoom] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [collectedPieces, setCollectedPieces] = useState([]);
  const [gamePhase, setGamePhase] = useState("start"); // start, play, eat
  const [eatenPieces, setEatenPieces] = useState([]);

  const moveRef = useRef({ f: 0, b: 0, l: 0, r: 0, u: 0, d: 0 });
  const rotateRef = useRef({ x: 0, y: 0 });
  const cameraRef = useRef();

  /* ---------- COLLECT PIECES ---------- */
  const collectPiece = (id) => {
    setCollectedPieces((prev) => [...prev, id]);
    setPieces((prev) => prev.filter((p) => p.id !== id));
    const audio = new Audio(Collect);
    audio.play();
  };

  /* ---------- SPAWN CHOCOLATES ---------- */
  useEffect(() => {
    if (!bounds || pieces.length > 0) return;

    const arr = [];
    const center = new THREE.Vector3();
    bounds.getCenter(center);

    for (let i = 0; i < 12; i++) {
      const x = THREE.MathUtils.randFloat(center.x - 5, center.x + 5);
      const y = THREE.MathUtils.randFloat(bounds.min.y + 0.25, bounds.min.y + 2);
      const z = THREE.MathUtils.randFloat(center.z - 5, center.z + 5);
      arr.push({ id: i, position: [x, y, z] });
    }

    setPieces(arr);
  }, [bounds, pieces.length]);

  /* ---------- JOYSTICK CONTROLS ---------- */
  const handleMove = (stick) => {
    moveRef.current.f = stick.y < 0 ? -stick.y / 25 : 0;
    moveRef.current.b = stick.y > 0 ? stick.y / 25 : 0;
    moveRef.current.r = stick.x > 0 ? stick.x / 25 : 0;
    moveRef.current.l = stick.x < 0 ? -stick.x / 25 : 0;
  };
  const handleStop = () => (moveRef.current = { f: 0, b: 0, l: 0, r: 0, u: 0, d: 0 });
  const handleCameraMove = (stick) => {
    rotateRef.current.x = stick.x * 0.09;
    rotateRef.current.y = stick.y * 0.01;
  };
  const handleCameraStop = () => (rotateRef.current = { x: 0, y: 0 });

  /* ---------- GRADIENT HELPER ---------- */
  const createGradient = (colorStart, colorEnd) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  };

  /* ---------- START SCREEN ---------- */
  if (gamePhase === "start") {
    return (
      <div className="start-screen">
        <h1>🍫 Chocolate Hunting 🍫</h1>
        <p>Left joystick to move, right joystick to look horizontally & vertically, tap chocolate to collect.</p>
        <button onClick={() => setGamePhase("play")}>Start Game</button>
      </div>
    );
  }

  /* ---------- EAT CHOCOLATE SCENE ---------- */
  if (gamePhase === "eat") {
    const allEaten = eatenPieces.length === 12;
    return (
      <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
        <div className="chocolate-bar-ui">
          {!allEaten && (
            <>
              <div className="chocolate-bar-title">🍫 Your Chocolate Bar 🍫</div>
              <div className="chocolate-bar-instruction">Tap on a chocolate piece to eat it!</div>
            </>
          )}
        </div>

        <Canvas style={{ width: "100%", height: "100%" }} camera={{ position: [0, 3, 10], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <Suspense fallback={null}>
            {/* FLOOR */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
              <planeGeometry args={[20, 20]} />
              <meshStandardMaterial>
                <primitive attach="map" object={new THREE.CanvasTexture(createGradient("#ff1b6b", "#45caff"))} />
              </meshStandardMaterial>
            </mesh>

            {/* WALLS */}
            {/* LEFT */}
            <mesh position={[-10, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[20, 10]} />
              <meshStandardMaterial>
                <primitive attach="map" object={new THREE.CanvasTexture(createGradient("#e81cff", "#40c9ff"))} />
              </meshStandardMaterial>
            </mesh>
            {/* RIGHT */}
            <mesh position={[10, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[20, 10]} />
              <meshStandardMaterial>
                <primitive attach="map" object={new THREE.CanvasTexture(createGradient("#e81cff", "#40c9ff"))} />
              </meshStandardMaterial>
            </mesh>
            {/* BACK */}
            <mesh position={[0, 3, -10]}>
              <planeGeometry args={[20, 10]} />
              <meshStandardMaterial>
                <primitive attach="map" object={new THREE.CanvasTexture(createGradient("#e81cff", "#40c9ff"))} />
              </meshStandardMaterial>
            </mesh>

            {/* 3x4 chocolate grid */}
            {collectedPieces.map((_, i) => {
              if (eatenPieces.includes(i)) return null;

              const col = i % 3;
              const row = Math.floor(i / 3);
              const spacingX = 1.3;
              const spacingY = 1.3;
              const gridHeight = (4 - 1) * spacingY;

              return (
                <Chocolate
                  key={i}
                  position={[col * spacingX - 1.5, row * spacingY - gridHeight / 2 + 1, 2.5]}
                  rotation={[Math.PI / 2.1, 0, 0]}
                  scale={40}
                  room={null}
                  onCollect={() => {
                    setEatenPieces((prev) => [...prev, i]);
                    const audio = new Audio(Eat);
                    audio.play();
                  }}
                />
              );
            })}

            <Environment preset="sunset" />
          </Suspense>
        </Canvas>

        {allEaten && (
          <>
            <div className="chocolate-bar-happy-overlay"></div>
            <div className="chocolate-bar-happy-2d">🎉 You completed the game!🍫</div>
          </>
        )}
      </div>
    );
  }

  /* ---------- MAIN GAME SCENE ---------- */
  return (
    <>
      {/* Chocolate HUD */}
      <div className="chocolate-bar">
        {Array.from({ length: 12 }).map((_, i) => (
          <img
            key={i}
            src={ChocolateBar}
            className={collectedPieces.includes(i) ? "collected" : "empty"}
          />
        ))}
      </div>

      {/* Eat Chocolate Button */}
      {collectedPieces.length === 12 && (
        <>
          <div className="eat-chocolate-overlay"></div>
          <div className="eat-chocolate-button-2d">
            <button onClick={() => setGamePhase("eat")}>Eat Your Chocolate 🍫</button>
          </div>
        </>
      )}

      {/* Joysticks */}
      <div className="vertical-controls">
        <button onPointerDown={() => (moveRef.current.u = 1)} onPointerUp={() => (moveRef.current.u = 0)}>Up</button>
        <button onPointerDown={() => (moveRef.current.d = 1)} onPointerUp={() => (moveRef.current.d = 0)}>Down</button>
      </div>
      <div className="joystick-left">
        <Joystick size={100} sticky={false} baseColor="#888" stickColor="#555" move={handleMove} stop={handleStop} />
      </div>
      <div className="joystick-right">
        <Joystick size={100} sticky={false} baseColor="#888" stickColor="#555" move={handleCameraMove} stop={handleCameraStop} />
      </div>

      {/* 3D Canvas */}
      <Canvas style={{ width: "100vw", height: "100vh" }} camera={{ position: [0, 1.6, 5], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <Suspense fallback={null}>
          <RoomModel setBounds={setBounds} setRoom={setRoom} />
          {room &&
            pieces.map((piece) => (
              <Chocolate
                key={piece.id}
                position={piece.position}
                room={room}
                onCollect={() => collectPiece(piece.id)}
              />
            ))}
          <Environment preset="apartment" />
          <PlayerCamera bounds={bounds} moveRef={moveRef} rotateRef={rotateRef} cameraRef={cameraRef} />
        </Suspense>
      </Canvas>
    </>
  );
}
