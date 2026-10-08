import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:8765/dashboard"
OUT = Path("graphify-out/browser-audit")
OUT.mkdir(parents=True, exist_ok=True)


def accessible_name(el):
    return (el.get_attribute("aria-label") or el.inner_text() or el.get_attribute("title") or "").strip()


def inspect_page(page, label, full_page=True):
    metrics = page.evaluate(
        """() => {
          const vw = document.documentElement.clientWidth;
          const visible = (el) => {
            const s = getComputedStyle(el), r = el.getBoundingClientRect();
            return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
          };
          const overflow = [...document.querySelectorAll('body *')]
            .filter(visible)
            .map(el => {
              const r = el.getBoundingClientRect();
              return {tag: el.tagName.toLowerCase(), id: el.id || null,
                cls: String(el.className || '').slice(0, 100), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width)};
            })
            .filter(x => x.left < -2 || x.right > vw + 2)
            .slice(0, 30);
          const nav = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          return {
            title: document.title,
            lang: document.documentElement.lang,
            viewport: {width: innerWidth, height: innerHeight},
            document: {scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight},
            horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
            overflowElements: overflow,
            domNodes: document.getElementsByTagName('*').length,
            resourceCount: resources.length,
            transferredBytes: resources.reduce((s, r) => s + (r.transferSize || 0), 0),
            domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
            loadMs: nav ? Math.round(nav.loadEventEnd) : null,
            externalResources: resources.filter(r => !r.name.startsWith(location.origin)).map(r => r.name),
          };
        }"""
    )
    missing = []
    for selector in ["button", "a[href]", "input", "select"]:
        for i, el in enumerate(page.locator(selector).all()):
            try:
                if el.is_visible() and not accessible_name(el):
                    missing.append({"selector": selector, "index": i, "id": el.get_attribute("id")})
            except Exception:
                pass
    metrics["interactiveWithoutName"] = missing
    page.screenshot(path=str(OUT / f"{label}.png"), full_page=full_page)
    return metrics


def load(page, url):
    started = time.perf_counter()
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        pass
    page.wait_for_timeout(1200)
    return round((time.perf_counter() - started) * 1000)


def run_view(browser, label, viewport, mobile=False):
    ctx = browser.new_context(
        viewport=viewport,
        device_scale_factor=1,
        is_mobile=mobile,
        has_touch=mobile,
        reduced_motion="reduce",
        locale="pt-BR",
    )
    ctx.add_init_script(
        script="""
        (() => {
          const bounds = () => ({
            getCenter: () => ({lat: -3.75, lng: -38.52}),
            isValid: () => true,
            pad() { return this; }
          });
          const layer = (feature = null) => ({
            feature, _events: {}, _style: {},
            on(a, b) { if (typeof a === 'string') this._events[a] = b; else Object.assign(this._events, a || {}); return this; },
            setStyle(s) { this._style = typeof s === 'function' ? s(this.feature) : s; return this; },
            bringToFront() { return this; },
            getBounds: bounds,
            getElement() { return null; },
            bindTooltip() { return this; },
            addTo(target) { if (target && target.addLayer) target.addLayer(this); return this; }
          });
          const group = (items = []) => ({
            _layers: [...items],
            addTo() { return this; },
            addLayer(x) { this._layers.push(x); return this; },
            clearLayers() { this._layers = []; return this; },
            getLayers() { return this._layers; },
            eachLayer(fn) { this._layers.forEach(fn); return this; },
            setStyle(s) { this._layers.forEach(x => x.setStyle && x.setStyle(s)); return this; },
            getBounds: bounds
          });
          const geoJSON = (data, opts = {}) => {
            const features = data?.type === 'FeatureCollection' ? data.features : data?.type === 'Feature' ? [data] : [];
            const layers = features.map(f => {
              const x = layer(f);
              if (opts.style) x.setStyle(opts.style);
              if (opts.onEachFeature) opts.onEachFeature(f, x);
              return x;
            });
            return group(layers);
          };
          const map = () => {
            const panes = {};
            return {
              scrollWheelZoom: {enable() {}, disable() {}},
              createPane(n) { return panes[n] = {style: {}}; },
              getPane(n) { return panes[n] || null; },
              fitBounds() { return this; }, flyToBounds() { return this; }, setView() { return this; },
              invalidateSize() { return this; }, removeLayer() { return this; }, hasLayer() { return false; },
              on() { return this; }, getZoom() { return 12; }
            };
          };
          window.L = {
            map, geoJSON, layerGroup: group,
            tileLayer: () => layer(), marker: () => layer(), circleMarker: () => layer(), polyline: () => layer(),
            divIcon: x => x, latLngBounds: bounds,
            DomEvent: {disableClickPropagation() {}, disableScrollPropagation() {}, stopPropagation() {}}
          };
        })();
        """
    )
    page = ctx.new_page()
    events = {"console": [], "pageErrors": [], "requestFailures": []}
    page.on("console", lambda m: events["console"].append({"type": m.type, "text": m.text}) if m.type in ("warning", "error") else None)
    page.on("pageerror", lambda e: events["pageErrors"].append(str(e)))
    page.on("requestfailed", lambda r: events["requestFailures"].append({"url": r.url, "error": r.failure}))

    index_load = load(page, f"{BASE}/index.html")
    ready = True
    try:
        page.locator("#ranking-lista li").first.wait_for(state="visible", timeout=15000)
    except Exception:
        ready = False
    initial = inspect_page(page, f"{label}-index-full")
    initial["wallLoadMs"] = index_load
    initial["rankingCount"] = page.locator("#ranking-lista li").count()
    initial["mapRendered"] = page.locator("#mapa-leaflet .leaflet-pane").count() > 0

    if not ready:
        morar_load = load(page, f"{BASE}/morar.html")
        morar = inspect_page(page, f"{label}-morar-load-failure")
        morar["wallLoadMs"] = morar_load
        morar["resultVisible"] = page.locator("#resultado").is_visible()
        return {
            "label": label,
            "index": initial,
            "indexInteraction": {"skipped": "ranking did not render"},
            "morar": morar,
            "events": events,
            "eventsBeforeMorar": {k: len(v) for k, v in events.items()},
        }

    page.get_by_role("button", name="Renda", exact=True).click()
    page.locator("#busca").fill("Meireles")
    page.wait_for_timeout(250)
    names = page.locator("#ranking-lista li").all_inner_texts()
    if page.locator("#ranking-lista li button").count():
        page.locator("#ranking-lista li button").first.click()
        page.wait_for_timeout(250)
    index_interaction = {
        "searchResults": names,
        "selectedCardText": page.locator("#ficha").inner_text()[:700],
        "indicatorPressed": page.locator("#ctl-indicador button[aria-pressed='true']").inner_text(),
    }
    page.locator("#busca").fill("")
    page.locator("#camadas-botao").click()
    index_interaction["layersPanelVisible"] = page.locator("#camadas-painel").is_visible()
    page.locator("#camadas-botao").click()
    page.get_by_role("button", name="Renda real", exact=True).click()
    index_interaction["evolutionPressed"] = page.locator("#ctl-evo button[aria-pressed='true']").inner_text()
    page.screenshot(path=str(OUT / f"{label}-index-interaction.png"), full_page=False)

    before_morar_errors = {k: len(v) for k, v in events.items()}
    morar_load = load(page, f"{BASE}/morar.html")
    page.locator("#avancar").click()
    page.wait_for_timeout(200)
    step_titles = []
    for _ in range(24):
        if page.locator("#resultado").is_visible():
            break
        title = page.locator(".passo-titulo").last
        if title.count() and title.is_visible():
            step_titles.append(title.inner_text())
        if page.locator(".destino-caixa").count() and page.locator(".destino-caixa").last.is_visible():
            page.locator(".destino").last.click()
            page.locator(".opcao:not([disabled])").nth(1).click()
            page.wait_for_timeout(300)
        elif page.locator(".opcao:not([disabled])").count() and page.locator(".opcao:not([disabled])").last.is_visible():
            page.locator(".opcao:not([disabled])").nth(1).click()
            page.wait_for_timeout(300)
        elif not page.locator("#avancar").is_disabled():
            page.locator("#avancar").click()
            page.wait_for_timeout(250)
        else:
            break
    morar = inspect_page(page, f"{label}-morar-result")
    morar["wallLoadMs"] = morar_load
    morar["stepTitles"] = step_titles
    morar["resultVisible"] = page.locator("#resultado").is_visible()
    morar["resultCards"] = page.locator("#cards li").count()
    morar["shareHashLength"] = len(page.evaluate("location.hash"))
    morar["mapRendered"] = page.locator("#mapa-morar .leaflet-pane").count() > 0

    result = {
        "label": label,
        "index": initial,
        "indexInteraction": index_interaction,
        "morar": morar,
        "events": events,
        "eventsBeforeMorar": before_morar_errors,
    }
    ctx.close()
    return result


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    results = [
        run_view(browser, "desktop", {"width": 1440, "height": 900}),
        run_view(browser, "mobile", {"width": 390, "height": 844}, mobile=True),
    ]
    browser.close()

(OUT / "results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps(results, indent=2, ensure_ascii=False))
