"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function NetworkScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.z = 34;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const NODE_COUNT = 110;
    const nodeGeo = new THREE.SphereGeometry(0.13, 10, 10);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0x9ccaff,
      transparent: true,
      opacity: 0.95,
    });
    const brightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });

    const positions: THREE.Vector3[] = [];
    const nodes: THREE.Mesh[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const r = 14 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions.push(new THREE.Vector3(x, y, z));

      const m = new THREE.Mesh(
        nodeGeo,
        Math.random() < 0.08 ? brightMat : nodeMat,
      );
      m.position.set(x, y, z);
      m.userData.phase = Math.random() * Math.PI * 2;
      m.userData.speed = 0.5 + Math.random() * 1.5;
      root.add(m);
      nodes.push(m);
    }

    const linePos: number[] = [];
    const lineAlpha: number[] = [];
    const THRESH = 5.5;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = positions[i].distanceTo(positions[j]);
        if (d < THRESH) {
          const a = 1 - d / THRESH;
          linePos.push(
            positions[i].x,
            positions[i].y,
            positions[i].z,
            positions[j].x,
            positions[j].y,
            positions[j].z,
          );
          lineAlpha.push(a, a);
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePos, 3),
    );
    lineGeo.setAttribute(
      "aAlpha",
      new THREE.Float32BufferAttribute(lineAlpha, 1),
    );

    const lineMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0x4a9eff) },
      },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * 0.55);
        }
      `,
    });

    const lines = new THREE.LineSegments(lineGeo, lineMat);
    root.add(lines);

    let mx = 0;
    let my = 0;
    const onMove = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      root.rotation.y += 0.0009;
      root.rotation.x = Math.sin(t * 0.1) * 0.15;

      nodes.forEach((n) => {
        const s =
          1 + Math.sin(t * n.userData.speed + n.userData.phase) * 0.25;
        n.scale.setScalar(s);
      });

      camera.position.x += (mx * 3 - camera.position.x) * 0.02;
      camera.position.y += (-my * 2 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
      nodeGeo.dispose();
      nodeMat.dispose();
      brightMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
