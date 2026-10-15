from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:5340/aprovacao.html"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="C:/Program Files/Google/Chrome/Application/chrome.exe",
        args=["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on(
        "console",
        lambda msg: errors.append(msg.text)
        if msg.type == "error" and "Failed to load resource" not in msg.text
        else None,
    )
    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("localStorage.removeItem('aprovacao-marcos3d')")
    page.reload()
    page.wait_for_load_state("networkidle")

    assert page.locator("article.modelo").count() == 30
    assert page.locator("#total-pendentes").inner_text() == "30"
    page.get_by_role("button", name="Aprimorados 13").click()
    assert page.locator("article.modelo:visible").count() == 13
    page.get_by_role("button", name="Topo").click()
    assert "tsx-topo.png" in page.locator("article.modelo:visible .quadro-depois img").first.get_attribute("src")
    page.locator("article.modelo:visible").first.get_by_role("button", name="Aprovar").click()
    assert page.locator("#total-aprovados").inner_text() == "1"
    page.screenshot(path=ROOT / "renders" / "aprovacao-desktop.png", full_page=False)

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(URL)
    mobile.wait_for_load_state("networkidle")
    assert mobile.locator("article.modelo").count() == 30
    mobile.screenshot(path=ROOT / "renders" / "aprovacao-mobile.png", full_page=False)
    assert not errors, "Browser errors: " + " | ".join(errors)
    browser.close()

print("OK: 30 modelos, filtros, vistas, decisões persistentes e layout móvel")
