"""Test whether map pins appear on desktop viewport."""
import json
import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome"
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    api_calls = []
    page.on("response", lambda r: api_calls.append(r.url) if "/api/" in r.url else None)

    print("Navigating to /map …")
    page.goto("http://localhost:3000/map", timeout=60000, wait_until="domcontentloaded")
    page.wait_for_timeout(5000)  # let JS + Mapbox initialize
    page.screenshot(path="/tmp/01_initial.png")
    print("Screenshot saved: /tmp/01_initial.png")

    # Click roughly in California (map center is USA, CA is upper-left quadrant)
    # Map fills center of 3-panel layout. Sidebar ~240px, map ~800px wide
    # CA is roughly at 35% from left, 40% from top of the map area
    map_left = 240   # sidebar width on desktop
    map_width = 800  # approximate map width
    map_top = 56     # navbar height
    map_height = 744 # remaining height

    ca_x = map_left + int(map_width * 0.20)   # CA is left side of US
    ca_y = map_top  + int(map_height * 0.40)   # middle-ish vertically

    print(f"Clicking at ({ca_x}, {ca_y}) — should be somewhere in western US …")
    page.mouse.click(ca_x, ca_y)
    page.wait_for_timeout(6000)  # wait for geocode + data fetch
    page.screenshot(path="/tmp/02_after_click.png")
    print("Screenshot saved: /tmp/02_after_click.png")

    # Print API calls so far
    print(f"\nAPI calls made: {api_calls}")

    # Check current map state via JS
    map_info = page.evaluate("""() => {
        const mapEl = document.querySelector('.mapboxgl-canvas');
        if (!mapEl) return { error: 'no canvas found' };

        // Try to access the mapbox map instance via the container
        const container = mapEl.closest('.mapboxgl-map');
        if (!container) return { error: 'no map container' };

        // Check for visible markers or canvas layers
        const markers = document.querySelectorAll('.mapboxgl-marker');
        const canvases = document.querySelectorAll('.mapboxgl-canvas');

        return {
            markerCount: markers.length,
            canvasCount: canvases.length,
            containerSize: {
                w: container.offsetWidth,
                h: container.offsetHeight
            }
        };
    }""")
    print(f"\nMap DOM info: {json.dumps(map_info, indent=2)}")

    # Zoom in by scrolling on the map
    print("\nZooming in (scroll wheel 10x) …")
    for _ in range(10):
        page.mouse.wheel(ca_x, ca_y, delta_x=0, delta_y=-100)
        time.sleep(0.1)
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/03_zoomed_in.png")
    print("Screenshot saved: /tmp/03_zoomed_in.png")

    # Check for any GeoJSON source data via mapbox internals
    source_info = page.evaluate("""() => {
        try {
            // Mapbox attaches the map to the canvas element via __mb_map
            const canvas = document.querySelector('.mapboxgl-canvas');
            if (!canvas) return { error: 'no canvas' };

            // Try to find map instance from React fiber or global
            let map = null;

            // Check window for any exposed map instances
            const keys = Object.keys(window).filter(k =>
                window[k] && typeof window[k] === 'object' &&
                typeof window[k].getZoom === 'function'
            );

            if (keys.length > 0) {
                map = window[keys[0]];
            }

            if (!map) {
                // Try accessing via the container's _mapbox property
                const containers = document.querySelectorAll('.mapboxgl-map');
                for (const c of containers) {
                    if (c._mapbox) { map = c._mapbox; break; }
                }
            }

            if (!map) return { error: 'map instance not found', windowKeys: keys };

            const zoom = map.getZoom();
            const center = map.getCenter();
            const style = map.getStyle();
            const sourceIds = style ? Object.keys(style.sources || {}) : [];
            const layerIds = style ? (style.layers || []).map(l => l.id) : [];

            let resourceFeatureCount = 0;
            try {
                const features = map.querySourceFeatures('resources');
                resourceFeatureCount = features.length;
            } catch(e) { resourceFeatureCount = -1; }

            return {
                zoom: zoom.toFixed(2),
                center,
                sourceIds,
                layerIds,
                resourceFeatureCount
            };
        } catch(e) {
            return { error: e.toString() };
        }
    }""")
    print(f"\nMapbox source/layer info: {json.dumps(source_info, indent=2)}")

    # Print console messages
    print(f"\nConsole messages ({len(console_msgs)}):")
    for msg in console_msgs[-30:]:
        print(f"  {msg}")

    browser.close()
    print("\nDone.")
