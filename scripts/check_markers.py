from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    print("Navigating to app...")
    page.goto("http://localhost:3000/map")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    page.screenshot(path="/tmp/map_initial.png")
    print("Initial screenshot saved")

    # Click on California area on the map
    # California is roughly center-left of the US map
    # Map takes up middle portion of the 3-panel layout
    # Sidebar ~250px, map starts there, panel ~400px on right
    # CA centroid: lng=-119.7, lat=37.2 — need to find pixel coords
    # At zoom 3.8, center at -95.7, 37.1
    # Just click roughly where CA would be on the map
    map_area = page.locator('[aria-label="Interactive resource map"]')
    box = map_area.bounding_box()
    print(f"Map bounding box: {box}")

    if box:
        # CA is to the left of center on the US map
        ca_x = box["x"] + box["width"] * 0.12
        ca_y = box["y"] + box["height"] * 0.45
        print(f"Clicking CA at ({ca_x}, {ca_y})")
        page.mouse.click(ca_x, ca_y)
        time.sleep(4)
        page.wait_for_load_state("networkidle")
        time.sleep(2)

    page.screenshot(path="/tmp/map_after_ca_click.png")
    print("After CA click screenshot saved")

    # Now zoom in more
    if box:
        # Scroll to zoom in on CA
        ca_x = box["x"] + box["width"] * 0.12
        ca_y = box["y"] + box["height"] * 0.45
        for _ in range(5):
            page.mouse.wheel(ca_x, ca_y, 0, -300)
            time.sleep(0.5)
        time.sleep(3)

    page.screenshot(path="/tmp/map_zoomed_ca.png")
    print("Zoomed CA screenshot saved")

    browser.close()
    print("Done")
