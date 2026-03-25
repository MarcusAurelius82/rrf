from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome"
    )
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    print("Navigating to map...")
    page.goto("http://localhost:3000/map")
    page.wait_for_load_state("networkidle")
    time.sleep(4)

    page.screenshot(path="/tmp/map_initial.png")
    print("Initial screenshot saved")

    # Find the map container and click California
    map_box = page.locator('[aria-label="Interactive resource map"]').bounding_box()
    print(f"Map box: {map_box}")

    if map_box:
        # CA is roughly 12% from left, 45% from top of map area
        ca_x = map_box["x"] + map_box["width"] * 0.12
        ca_y = map_box["y"] + map_box["height"] * 0.45
        print(f"Clicking CA at ({ca_x:.0f}, {ca_y:.0f})")
        page.mouse.click(ca_x, ca_y)
        time.sleep(5)
        page.wait_for_load_state("networkidle")
        time.sleep(2)

    page.screenshot(path="/tmp/map_ca_clicked.png")
    print("CA clicked screenshot saved")

    # Zoom in with scroll wheel
    if map_box:
        cx = map_box["x"] + map_box["width"] * 0.12
        cy = map_box["y"] + map_box["height"] * 0.45
        for _ in range(8):
            page.mouse.wheel(cx, cy, 0, -300)
            time.sleep(0.4)
        time.sleep(3)

    page.screenshot(path="/tmp/map_ca_zoomed.png")
    print("Zoomed screenshot saved")

    browser.close()
    print("Done")
