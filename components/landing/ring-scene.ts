// three.js scene for the landing page header: product photos on a slowly turning,
// draggable ring, with a woven kachabia-stripe ribbon running through it.
// Loaded on demand by ProductRing3D, so three.js never ships with the first page load.

import * as THREE from "three";

export interface RingItem {
    imageUrl: string;
}

export interface RingSceneOptions {
    /** Text direction of the page; the ring shifts away from the text side. */
    direction: "ltr" | "rtl";
    /** Called once the first frame with loaded photos has been drawn. */
    onReady: () => void;
    /** Index of the product currently facing the viewer. */
    onFrontChange: (index: number) => void;
    /** Click on the front product. */
    onSelect: (index: number) => void;
    /** First drag, so the "drag to turn" hint can go away. */
    onInteract: () => void;
}

export interface RingScene {
    /** Turns the ring by whole cards (positive = next). */
    step: (direction: 1 | -1) => void;
    dispose: () => void;
}

const CARD_W = 1.5;
const CARD_H = 2; // 3:4 portrait, like the product photos
const CARD_GAP = 0.42;
const AUTO_SPEED = 0.12; // radians per second while idle
const DRAG_SPEED = 0.0065; // radians per pixel

const cardVertex = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Photo with object-cover (top-aligned) fit and rounded corners. Cards turning away
// from the viewer darken toward the wool brown and fade out before going edge-on.
const cardFragment = /* glsl */ `
    uniform sampler2D uMap;
    uniform float uImgAspect;
    uniform float uCardAspect;
    uniform float uLoaded;
    uniform float uFront;
    uniform float uHover;
    varying vec2 vUv;

    void main() {
        vec2 uv = vUv;
        vec2 tuv = uv;
        if (uImgAspect > uCardAspect) {
            tuv.x = (uv.x - 0.5) * (uCardAspect / uImgAspect) + 0.5;
        } else {
            tuv.y = 1.0 - (1.0 - uv.y) * (uImgAspect / uCardAspect);
        }

        vec2 size = vec2(uCardAspect, 1.0);
        vec2 p = (uv - 0.5) * size;
        float r = 0.045;
        vec2 q = abs(p) - size * 0.5 + r;
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        float mask = 1.0 - smoothstep(-0.003, 0.0, d);

        vec3 blank = vec3(0.953, 0.937, 0.914);
        vec3 photo = texture2D(uMap, tuv).rgb;
        vec3 col = mix(blank, photo, uLoaded);
        float facing = smoothstep(0.0, 0.95, uFront);
        col = mix(col * 0.55 + vec3(0.231, 0.165, 0.129) * 0.25, col, facing);
        col += uHover * 0.035;
        // Cards fade out as they turn edge-on.
        float alpha = mask * smoothstep(0.02, 0.3, uFront);
        gl_FragColor = vec4(col, alpha);
    }
`;

const ribbonVertex = /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vShade;
    void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.x * 0.75 + uTime * 0.6) * 0.28 + sin(pos.x * 1.9 - uTime * 0.9) * 0.07;
        pos.z += wave;
        pos.y += sin(pos.x * 0.45 + uTime * 0.35) * 0.18;
        // Fold shading from the wave's slope, so the cloth reads as draped.
        vShade = cos(pos.x * 0.75 + uTime * 0.6) * 0.5 + 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

// Hem stripes of a kachabia: brown, undyed, maroon, undyed, camel, undyed, brown.
const ribbonFragment = /* glsl */ `
    uniform float uViewWidth;
    varying vec2 vUv;
    varying float vShade;

    vec3 band(float v) {
        vec3 brown = vec3(0.231, 0.165, 0.129);
        vec3 undyed = vec3(0.914, 0.882, 0.827);
        vec3 maroon = vec3(0.478, 0.231, 0.180);
        vec3 camel = vec3(0.663, 0.510, 0.310);
        if (v < 0.2) return brown;
        if (v < 0.27) return undyed;
        if (v < 0.47) return maroon;
        if (v < 0.54) return undyed;
        if (v < 0.73) return camel;
        if (v < 0.8) return undyed;
        return brown;
    }

    void main() {
        vec3 col = band(vUv.y);
        float threads = sin(vUv.x * 900.0) * 0.5 + 0.5;
        float picks = sin(vUv.y * 140.0) * 0.5 + 0.5;
        col *= 0.93 + threads * picks * 0.1;
        col *= 0.8 + vShade * 0.25;
        float sx = gl_FragCoord.x / uViewWidth;
        float fade = smoothstep(0.0, 0.18, sx) * (1.0 - smoothstep(0.82, 1.0, sx));
        gl_FragColor = vec4(col, fade);
    }
`;

/** Bends a flat card so it follows the ring's curve. */
function curvedCardGeometry(radius: number) {
    const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 24, 1);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const a = pos.getX(i) / radius;
        pos.setX(i, Math.sin(a) * radius);
        pos.setZ(i, Math.cos(a) * radius - radius);
    }
    geometry.computeBoundingSphere();
    return geometry;
}

function wrapAngle(a: number) {
    const tau = Math.PI * 2;
    return ((a % tau) + tau + Math.PI) % tau - Math.PI;
}

export function createRingScene(container: HTMLElement, items: RingItem[], options: RingSceneOptions): RingScene {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "pan-y";
    canvas.style.cursor = "grab";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

    const count = items.length;
    const stepAngle = (Math.PI * 2) / count;
    const radius = Math.max(1.6, (count * (CARD_W + CARD_GAP)) / (Math.PI * 2));

    // Ring of cards
    const ring = new THREE.Group();
    scene.add(ring);
    const geometry = curvedCardGeometry(radius);
    const loader = new THREE.TextureLoader();
    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const blankTexture = new THREE.DataTexture(new Uint8Array([243, 239, 233, 255]), 1, 1);
    blankTexture.needsUpdate = true;

    let pending = count;
    let readySignalled = false;
    const cards = items.map((item, index) => {
        const material = new THREE.ShaderMaterial({
            vertexShader: cardVertex,
            fragmentShader: cardFragment,
            transparent: true,
            side: THREE.FrontSide,
            uniforms: {
                uMap: { value: blankTexture },
                uImgAspect: { value: CARD_W / CARD_H },
                uCardAspect: { value: CARD_W / CARD_H },
                uLoaded: { value: 0 },
                uFront: { value: 0 },
                uHover: { value: 0 },
            },
        });
        const mesh = new THREE.Mesh(geometry, material);
        const angle = index * stepAngle;
        mesh.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        mesh.rotation.y = angle;
        mesh.userData.index = index;
        ring.add(mesh);

        const card = { mesh, material, angle, loaded: 0, texture: null as THREE.Texture | null };
        loader.load(
            item.imageUrl,
            (texture) => {
                texture.anisotropy = maxAnisotropy;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                const image = texture.image as HTMLImageElement;
                material.uniforms.uMap.value = texture;
                material.uniforms.uImgAspect.value = image.width / image.height;
                card.texture = texture;
                pending--;
            },
            undefined,
            () => {
                pending--;
            }
        );
        return card;
    });

    // Woven ribbon threading through the ring
    const ribbonMaterial = new THREE.ShaderMaterial({
        vertexShader: ribbonVertex,
        fragmentShader: ribbonFragment,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uViewWidth: { value: 1 } },
    });
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(radius * 5, 0.62, 220, 1), ribbonMaterial);
    ribbon.position.set(0, -CARD_H * 0.36, 0);
    ribbon.rotation.z = -0.06;
    scene.add(ribbon);

    // Camera framing for a full-width header background, looking slightly down so the
    // back of the ring shows above the front cards. The ring may run past the edges.
    //   wide (desktop): ring shifted toward the end side, away from the text
    //   phone: front card framed large, ring pushed down below the text
    const resize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        ribbonMaterial.uniforms.uViewWidth.value = width * renderer.getPixelRatio();
        camera.aspect = width / height;
        const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const wide = width >= 1024;
        const phone = width < 640;
        // The front card takes about half the header's height and at most 80% of its width.
        const frontShare = wide ? 0.5 : phone ? 0.34 : 0.44;
        const frontDistance = Math.max(
            CARD_H / (frontShare * 2 * halfV),
            CARD_W / (0.8 * 2 * halfV * camera.aspect)
        );
        const distance = radius + frontDistance;
        camera.position.set(0, 0.55, distance);
        camera.lookAt(0, -0.05, 0);
        const side = options.direction === "rtl" ? 1 : -1;
        const offsetX = wide ? side * width * 0.16 : 0;
        const offsetY = phone ? -height * 0.23 : 0;
        camera.setViewOffset(width, height, offsetX, offsetY, width, height);
        camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Interaction: drag to turn with inertia, click the front card to open it,
    // click another card to bring it to the front.
    let rotation = 0;
    let velocity = AUTO_SPEED;
    let target: number | null = null;
    let dragging = false;
    let pointerStartX = 0;
    let lastX = 0;
    let moved = 0;
    let hovered: number | null = null;
    let interacted = false;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const pick = (event: PointerEvent): number | null => {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(ring.children, false)[0];
        if (!hit) return null;
        const index = hit.object.userData.index as number;
        // Only cards turned toward the viewer are clickable.
        return Math.cos(cards[index].angle + rotation) > 0.2 ? index : null;
    };

    const frontIndex = () => {
        const idx = Math.round(-rotation / stepAngle) % count;
        return (idx + count) % count;
    };

    const onPointerDown = (event: PointerEvent) => {
        dragging = true;
        target = null;
        pointerStartX = lastX = event.clientX;
        moved = 0;
        try {
            canvas.setPointerCapture(event.pointerId);
        } catch {
            // No capturable pointer (synthetic events); dragging still works inside the canvas.
        }
        canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
        if (dragging) {
            const dx = event.clientX - lastX;
            lastX = event.clientX;
            moved = Math.abs(event.clientX - pointerStartX);
            rotation += dx * DRAG_SPEED;
            velocity = (dx * DRAG_SPEED) * 60;
            if (moved > 6 && !interacted) {
                interacted = true;
                options.onInteract();
            }
            return;
        }
        if (event.pointerType === "mouse") {
            hovered = pick(event);
            canvas.style.cursor = hovered !== null ? "pointer" : "grab";
        }
    };
    const onPointerUp = (event: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        canvas.style.cursor = "grab";
        if (moved < 6) {
            const index = pick(event);
            if (index === null) return;
            if (index === frontIndex()) {
                options.onSelect(index);
            } else {
                const delta = wrapAngle(-(cards[index].angle) - rotation);
                target = rotation + delta;
            }
        }
    };
    const onPointerLeave = () => {
        hovered = null;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    // Render loop, paused while off screen or in a background tab.
    const clock = new THREE.Clock();
    let visible = true;
    const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) clock.getDelta();
    });
    intersection.observe(container);

    let lastFront = -1;
    let frame = 0;
    const tick = () => {
        frame = requestAnimationFrame(tick);
        if (!visible || document.hidden) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.elapsedTime;

        if (target !== null) {
            const diff = target - rotation;
            rotation += diff * Math.min(1, dt * 6);
            if (Math.abs(diff) < 0.001) {
                rotation = target;
                target = null;
                velocity = 0;
            }
        } else if (!dragging) {
            // Ease back to the idle turn; pause while a card is hovered.
            const idle = hovered !== null ? 0 : AUTO_SPEED;
            velocity += (idle - velocity) * Math.min(1, dt * 1.6);
            rotation += velocity * dt;
        }
        ring.rotation.y = rotation;

        for (const card of cards) {
            const uniforms = card.material.uniforms;
            uniforms.uFront.value = Math.cos(card.angle + rotation);
            if (card.texture && card.loaded < 1) {
                card.loaded = Math.min(1, card.loaded + dt * 2.5);
                uniforms.uLoaded.value = card.loaded;
            }
            const hoverTarget = hovered === card.mesh.userData.index ? 1 : 0;
            uniforms.uHover.value += (hoverTarget - uniforms.uHover.value) * Math.min(1, dt * 8);
            const scale = 1 + uniforms.uHover.value * 0.03;
            card.mesh.scale.set(scale, scale, scale);
        }
        ribbonMaterial.uniforms.uTime.value = elapsed;

        const front = frontIndex();
        if (front !== lastFront) {
            lastFront = front;
            options.onFrontChange(front);
        }

        renderer.render(scene, camera);

        if (!readySignalled && pending <= 0) {
            readySignalled = true;
            options.onReady();
        }
    };
    tick();

    return {
        step(direction) {
            const base = target ?? rotation;
            const snapped = -Math.round(-base / stepAngle) * stepAngle;
            target = snapped - direction * stepAngle;
            if (!interacted) {
                interacted = true;
                options.onInteract();
            }
        },
        dispose() {
            cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            intersection.disconnect();
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerUp);
            canvas.removeEventListener("pointerleave", onPointerLeave);
            for (const card of cards) {
                card.material.dispose();
                card.texture?.dispose();
            }
            geometry.dispose();
            blankTexture.dispose();
            ribbon.geometry.dispose();
            ribbonMaterial.dispose();
            renderer.dispose();
            canvas.remove();
        },
    };
}
