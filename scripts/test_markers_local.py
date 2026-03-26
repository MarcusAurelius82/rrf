from playwright.sync_api import sync_playwright
import time

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome",
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--enable-webgl",
            "--use-gl=swiftshader",
            "--enable-accelerated-2d-canvas",
            "--ignore-gpu-blocklist",
        ]
    )
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    # Capture console errors
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)

    print("Navigating to local map...")
    page.goto("http://localhost:3000/map", wait_until="domcontentloaded")
    time.sleep(10)  # wait longer for Mapbox to init

    page.screenshot(path="/tmp/local_initial.png")
    print("Initial screenshot saved")

    # Print any errors
    for e in errors[-10:]:
        print(e)
    errors.clear()

    map_box = page.locator('[aria-label="Interactive resource map"]').bounding_box()
    print(f"Map box: {map_box}")

    if map_box:
        ca_x = map_box["x"] + map_box["width"] * 0.12
        ca_y = map_box["y"] + map_box["height"] * 0.45
        print(f"Clicking CA at ({ca_x:.0f}, {ca_y:.0f})")
        page.mouse.click(ca_x, ca_y)
        time.sleep(8)

    page.screenshot(path="/tmp/local_ca_clicked.png")
    print("After CA click saved")

    for e in errors[-10:]:
        print(e)
    errors.clear()

    # Zoom in using keyboard instead of mouse wheel
    map_el = page.locator('[aria-label="Interactive resource map"]')
    map_el.click()
    for _ in range(6):
        page.keyboard.press("+")
        time.sleep(0.3)
    time.sleep(4)

    page.screenshot(path="/tmp/local_ca_zoomed.png")
    print("Zoomed screenshot saved")

    browser.close()
    print("Done")
