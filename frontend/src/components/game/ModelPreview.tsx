import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ModelPreviewProps {
  modelUrl: string;
  className?: string;
}

/**
 * Componente interactivo para previsualizar un modelo 3D con rotacion automatica
 * y soporte para rotacion manual mediante arrastre del raton o touch.
 */
export const ModelPreview: React.FC<ModelPreviewProps> = ({ modelUrl, className = 'h-48' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDisposed = false;
    let animId: number;

    // 1. Escena, Camara y Renderizador
    const scene = new THREE.Scene();

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 192;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 0.95, 2.75);
    camera.lookAt(0, 0.9, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.appendChild(renderer.domElement);

    // 2. Iluminacion equilibrada tipo pasarela
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 1.4);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.8);
    fillLight.position.set(-2, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.6);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // 3. Pedestal estilizado
    const pedestalGroup = new THREE.Group();
    const pedestalGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.04, 36);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.3,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, -0.02, 0);
    pedestalGroup.add(pedestal);

    // Borde brillante en el pedestal
    const ringGeo = new THREE.RingGeometry(0.53, 0.55, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.001, 0);
    pedestalGroup.add(ring);

    scene.add(pedestalGroup);

    // 4. Cargar modelo GLB
    const loader = new GLTFLoader();
    let modelRoot: THREE.Group | null = null;

    loader.load(
      modelUrl,
      (gltf) => {
        if (isDisposed) return;
        modelRoot = gltf.scene;

        // Asegurar posicion base en el suelo
        modelRoot.position.set(0, 0, 0);
        scene.add(modelRoot);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error(`[ERROR] Fallo al cargar preview 3D: ${modelUrl}`, err);
        setLoading(false);
      }
    );

    // 5. Interaccion de arrastre (Orbit horizontal suave)
    let isDragging = false;
    let prevX = 0;
    let manualRotation = 0;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      prevX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - prevX;
      prevX = clientX;
      manualRotation += deltaX * 0.015;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    // 6. Ciclo de animacion
    let lastTime = performance.now();
    let autoRotation = 0;

    const animate = () => {
      if (isDisposed) return;
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (!isDragging) {
        autoRotation += delta * 0.5;
      }

      const totalRotation = autoRotation + manualRotation;
      if (modelRoot) {
        modelRoot.rotation.y = totalRotation;
      }
      pedestalGroup.rotation.y = totalRotation;

      renderer.render(scene, camera);
    };

    animate();

    // 7. Observador de redimension
    const resizeObserver = new ResizeObserver(() => {
      if (!container || isDisposed) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      if (newW > 0 && newH > 0) {
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      }
    });

    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();

      dom.removeEventListener('mousedown', onPointerDown);
      dom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200/80 dark:from-slate-900/90 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800 shadow-inner flex items-center justify-center ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/10 dark:bg-slate-950/40 backdrop-blur-[2px] z-10">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Cargando modelo 3D...
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        title="Arrastre horizontalmente para rotar"
      />
    </div>
  );
};
export default ModelPreview;
