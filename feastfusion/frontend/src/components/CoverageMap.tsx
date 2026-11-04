import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { api, naira, type DeliveryZone } from '../lib/api'
import { NIGERIA_OUTLINE } from '../lib/nigeria'
import './CoverageMap.css'

/* ---------- projection: longitude/latitude -> flat map plane ---------- */

const lngs = NIGERIA_OUTLINE.map(([lng]) => lng)
const lats = NIGERIA_OUTLINE.map(([, lat]) => lat)

const LNG_CENTER = (Math.min(...lngs) + Math.max(...lngs)) / 2
const LAT_CENTER = (Math.min(...lats) + Math.max(...lats)) / 2
const LAT_SPAN = Math.max(...lats) - Math.min(...lats)
const COS_LAT = Math.cos((LAT_CENTER * Math.PI) / 180)

/** Scene units per degree of latitude, chosen so the country stands ~9.6 units tall. */
const SCALE = 9.6 / LAT_SPAN
const UNIT_PER_KM = SCALE / 111

const HALF_W = ((Math.max(...lngs) - Math.min(...lngs)) * COS_LAT * SCALE) / 2 + 0.3
const HALF_D = 9.6 / 2 + 0.3

const SLAB_DEPTH = 0.3
const SLAB_TOP = SLAB_DEPTH

/** Shape-space point (x, y) where y grows north. */
function project(lng: number, lat: number): THREE.Vector2 {
  return new THREE.Vector2(
    (lng - LNG_CENTER) * COS_LAT * SCALE,
    (lat - LAT_CENTER) * SCALE,
  )
}

/** World-space point on the top face of the slab. */
function toWorld(lng: number, lat: number, height = 0): THREE.Vector3 {
  const p = project(lng, lat)
  return new THREE.Vector3(p.x, SLAB_TOP + height, -p.y)
}

type Palette = {
  cap: string
  side: string
  edge: string
  live: string
  soon: string
  beam: string
}

const LIGHT: Palette = {
  cap: '#F1E5CD',
  side: '#C08A1E',
  edge: '#8A6410',
  live: '#D9A227',
  soon: '#8C8377',
  beam: '#F2C24B',
}

const DARK: Palette = {
  cap: '#1C1C1F',
  side: '#5A440F',
  edge: '#D9A227',
  live: '#E8B845',
  soon: '#6E6E72',
  beam: '#F2C24B',
}

function currentTheme(): 'dark' | 'light' {
  const attr = document.documentElement.dataset.theme
  if (attr === 'dark' || attr === 'light') return attr
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function CoverageMap() {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [failed, setFailed] = useState(false)
  const [focusState, setFocusState] = useState<string | null>(null)

  const mountRef = useRef<HTMLDivElement | null>(null)
  const focusRef = useRef<(state: string) => void>(() => {})

  useEffect(() => {
    let alive = true
    api
      .zones()
      .then((list) => alive && setZones(list))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || zones.length === 0) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setFailed(true)
      return
    }

    let palette = currentTheme() === 'dark' ? DARK : LIGHT
    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item)
      return item
    }

    const scene = new THREE.Scene()

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight, false)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      200,
    )

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minPolarAngle = 0.22
    controls.maxPolarAngle = 1.15
    controls.rotateSpeed = 0.6
    controls.zoomSpeed = 0.7

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    controls.autoRotate = !reducedMotion
    controls.autoRotateSpeed = 0.45

    /* ---------- lights ---------- */

    const hemi = new THREE.HemisphereLight(0xffffff, 0x40382c, 1.55)
    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(6, 12, 7)
    const fill = new THREE.DirectionalLight(0xf5d9a0, 0.5)
    fill.position.set(-8, 6, -6)
    scene.add(hemi, key, fill)

    /* ---------- country slab ---------- */

    const shape = new THREE.Shape(NIGERIA_OUTLINE.map(([lng, lat]) => project(lng, lat)))
    const slabGeo = track(
      new THREE.ExtrudeGeometry(shape, { depth: SLAB_DEPTH, bevelEnabled: false }),
    )
    // Extrude runs along +z; lay the slab flat so its thickness becomes height.
    slabGeo.rotateX(-Math.PI / 2)

    const capMat = track(new THREE.MeshStandardMaterial({ color: palette.cap, roughness: 0.92 }))
    const sideMat = track(
      new THREE.MeshStandardMaterial({ color: palette.side, roughness: 0.55, metalness: 0.25 }),
    )
    // ExtrudeGeometry groups: 0 = top/bottom faces, 1 = walls.
    const slab = new THREE.Mesh(slabGeo, [capMat, sideMat])
    scene.add(slab)

    const edgeGeo = track(
      new THREE.BufferGeometry().setFromPoints(
        NIGERIA_OUTLINE.map(([lng, lat]) => {
          const p = project(lng, lat)
          return new THREE.Vector3(p.x, SLAB_TOP + 0.004, -p.y)
        }),
      ),
    )
    const edgeMat = track(
      new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: 0.85 }),
    )
    const edge = new THREE.LineLoop(edgeGeo, edgeMat)
    scene.add(edge)

    /* ---------- delivery zones ---------- */

    const liveMat = track(
      new THREE.MeshBasicMaterial({
        color: palette.live,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    const rimMat = track(
      new THREE.MeshBasicMaterial({
        color: palette.live,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    )
    const dotMat = track(new THREE.MeshBasicMaterial({ color: palette.live }))
    const pillarMat = track(
      new THREE.MeshStandardMaterial({
        color: palette.live,
        emissive: new THREE.Color(palette.live),
        emissiveIntensity: 0.7,
        roughness: 0.4,
      }),
    )
    const soonMat = track(
      new THREE.LineDashedMaterial({
        color: palette.soon,
        transparent: true,
        opacity: 0.75,
        dashSize: 0.07,
        gapSize: 0.05,
      }),
    )
    const soonDotMat = track(
      new THREE.MeshBasicMaterial({ color: palette.soon, transparent: true, opacity: 0.65 }),
    )

    const discGeo = track(new THREE.CircleGeometry(1, 48))
    const rimGeo = track(new THREE.RingGeometry(0.94, 1, 64))
    const dotGeo = track(new THREE.CircleGeometry(0.05, 20))
    const pillarGeo = track(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10))

    const anchors = new Map<string, THREE.Vector3>()
    const kitchen = zones.find((z) => /abuja|fct/i.test(z.state)) ?? zones.find((z) => z.is_active)

    for (const zone of zones) {
      const world = toWorld(zone.lng, zone.lat)
      anchors.set(zone.state, world.clone())

      if (!zone.is_active) {
        const radius = Math.max(0.22, zone.radius_km * UNIT_PER_KM)
        const pts: THREE.Vector3[] = []
        for (let i = 0; i < 96; i += 1) {
          const a = (i / 96) * Math.PI * 2
          pts.push(
            new THREE.Vector3(
              world.x + Math.cos(a) * radius,
              SLAB_TOP + 0.006,
              world.z + Math.sin(a) * radius,
            ),
          )
        }
        const geo = track(new THREE.BufferGeometry().setFromPoints(pts))
        const ring = new THREE.LineLoop(geo, soonMat)
        ring.computeLineDistances()
        scene.add(ring)

        const marker = new THREE.Mesh(dotGeo, soonDotMat)
        marker.rotation.x = -Math.PI / 2
        marker.position.copy(world)
        marker.position.y = SLAB_TOP + 0.007
        scene.add(marker)
        continue
      }

      const radius = Math.max(0.24, zone.radius_km * UNIT_PER_KM)

      const disc = new THREE.Mesh(discGeo, liveMat)
      disc.rotation.x = -Math.PI / 2
      disc.position.set(world.x, SLAB_TOP + 0.003, world.z)
      disc.scale.setScalar(radius)
      scene.add(disc)

      const rim = new THREE.Mesh(rimGeo, rimMat)
      rim.rotation.x = -Math.PI / 2
      rim.position.set(world.x, SLAB_TOP + 0.005, world.z)
      rim.scale.setScalar(radius)
      scene.add(rim)

      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.rotation.x = -Math.PI / 2
      dot.position.set(world.x, SLAB_TOP + 0.008, world.z)
      scene.add(dot)

      const pillar = new THREE.Mesh(pillarGeo, pillarMat)
      pillar.position.set(world.x, SLAB_TOP + 0.21, world.z)
      scene.add(pillar)
    }

    /* ---------- pulsing beacon over the kitchen ---------- */

    const beacon = new THREE.Group()
    const beamGeo = track(new THREE.CylinderGeometry(0.014, 0.05, 1.15, 12, 1, true))
    const beamMat = track(
      new THREE.MeshBasicMaterial({
        color: palette.beam,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.position.y = 0.575
    const orbGeo = track(new THREE.SphereGeometry(0.075, 20, 16))
    const orbMat = track(new THREE.MeshBasicMaterial({ color: palette.beam }))
    const orb = new THREE.Mesh(orbGeo, orbMat)
    orb.position.y = 1.15
    beacon.add(beam, orb)

    if (kitchen) {
      const base = anchors.get(kitchen.state)
      if (base) beacon.position.set(base.x, SLAB_TOP, base.z)
      scene.add(beacon)
    }

    /* ---------- fit camera to the viewport ---------- */

    const viewDir = new THREE.Vector3(0, 0.78, 0.63).normalize()
    const host = mount

    function fit() {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      const aspect = w / h
      camera.aspect = aspect
      const vHalf = (camera.fov * Math.PI) / 360
      const hHalf = Math.atan(Math.tan(vHalf) * aspect)
      const byWidth = HALF_W / Math.tan(hHalf)
      const byDepth = (HALF_D * 0.85) / Math.tan(vHalf)
      const distance = Math.max(byWidth, byDepth, 7)
      camera.position.copy(viewDir).multiplyScalar(distance)
      camera.updateProjectionMatrix()
      controls.minDistance = distance * 0.6
      controls.maxDistance = distance * 1.7
      renderer.setSize(w, h, false)
      controls.update()
    }

    fit()

    /* ---------- focus a zone from the legend ---------- */

    const focusTarget = new THREE.Vector3()
    let focusing = false

    focusRef.current = (state: string) => {
      const anchor = anchors.get(state)
      if (!anchor) return
      focusTarget.copy(anchor)
      focusing = true
    }

    /* ---------- theme swaps ---------- */

    function applyPalette(next: Palette) {
      capMat.color.set(next.cap)
      sideMat.color.set(next.side)
      edgeMat.color.set(next.edge)
      liveMat.color.set(next.live)
      rimMat.color.set(next.live)
      dotMat.color.set(next.live)
      pillarMat.color.set(next.live)
      pillarMat.emissive.set(next.live)
      soonMat.color.set(next.soon)
      soonDotMat.color.set(next.soon)
      beamMat.color.set(next.beam)
      orbMat.color.set(next.beam)
    }

    const themeObserver = new MutationObserver(() => {
      const next = currentTheme() === 'dark' ? DARK : LIGHT
      if (next === palette) return
      palette = next
      applyPalette(palette)
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    /* ---------- interaction + loop ---------- */

    let idleTimer = 0
    const onStart = () => {
      controls.autoRotate = false
      window.clearTimeout(idleTimer)
    }
    const onEnd = () => {
      if (reducedMotion) return
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        controls.autoRotate = true
      }, 7000)
    }
    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)

    const resizeObserver = new ResizeObserver(() => fit())
    resizeObserver.observe(mount)

    const clock = new THREE.Clock()
    let frame = 0

    const render = () => {
      frame = requestAnimationFrame(render)
      const t = clock.getElapsedTime()

      if (!reducedMotion) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6)
        orb.scale.setScalar(0.85 + pulse * 0.45)
        beamMat.opacity = 0.16 + pulse * 0.22
        pillarMat.emissiveIntensity = 0.45 + pulse * 0.5
      }

      if (focusing) {
        controls.target.lerp(focusTarget, 0.12)
        const distance = camera.position.distanceTo(controls.target)
        const desired = focusTarget
          .clone()
          .add(viewDir.clone().multiplyScalar(Math.max(distance * 0.72, 5.2)))
        camera.position.lerp(desired, 0.1)
        if (camera.position.distanceTo(desired) < 0.06) focusing = false
      }

      controls.update()
      renderer.render(scene, camera)
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(idleTimer)
      resizeObserver.disconnect()
      themeObserver.disconnect()
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
      controls.dispose()
      scene.clear()
      for (const item of disposables) item.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
      focusRef.current = () => {}
    }
  }, [zones])

  function focus(state: string) {
    setFocusState(state)
    focusRef.current(state)
  }

  const live = zones.filter((z) => z.is_active)
  const soon = zones.filter((z) => !z.is_active)

  return (
    <div className="coverage-map">
      <div className="coverage-map__stage">
        {failed ? (
          <p className="coverage-map__fallback">
            Your browser could not start the 3D view. The delivery list below has the same
            information.
          </p>
        ) : (
          <div
            ref={mountRef}
            className="coverage-map__canvas"
            role="img"
            aria-label="A rotating 3D map of Nigeria showing the states FeastFusion delivers to."
          />
        )}
        {!failed && (
          <p className="coverage-map__hint">
            <span aria-hidden="true">✥</span> Drag to spin · pinch or scroll to zoom
          </p>
        )}
      </div>

      <div className="coverage-map__legend">
        <div className="coverage-map__group">
          <h3>
            Live now <span className="coverage-map__count">{live.length}</span>
          </h3>
          <ul>
            {live.map((z) => (
              <li key={z.id}>
                <button
                  type="button"
                  className={`coverage-map__row ${focusState === z.state ? 'is-focus' : ''}`}
                  onClick={() => focus(z.state)}
                >
                  <span className="coverage-map__swatch coverage-map__swatch--live" />
                  <span className="coverage-map__state">{z.state}</span>
                  <span className="coverage-map__fee">{naira(z.fee_kobo)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {soon.length > 0 && (
          <div className="coverage-map__group">
            <h3>
              Coming soon <span className="coverage-map__count">{soon.length}</span>
            </h3>
            <ul>
              {soon.map((z) => (
                <li key={z.id}>
                  <button
                    type="button"
                    className={`coverage-map__row coverage-map__row--soon ${
                      focusState === z.state ? 'is-focus' : ''
                    }`}
                    onClick={() => focus(z.state)}
                  >
                    <span className="coverage-map__swatch coverage-map__swatch--soon" />
                    <span className="coverage-map__state">{z.state}</span>
                    <span className="coverage-map__fee">Waitlist</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
