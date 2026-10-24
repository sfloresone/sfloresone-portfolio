// Run after `bun run build`, with Playwright Chromium and WebKit installed.
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const root = fileURLToPath(new URL("../dist/", import.meta.url));

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const asset = Bun.file(root + pathname);

    if (!pathname.endsWith("/") && await asset.exists()) return new Response(asset);

    const page = Bun.file(root + pathname.replace(/\/$/, "") + "/index.html");

    if (await page.exists()) return new Response(page);

    return new Response(Bun.file(root + "404.html"), { status: 404 });
  },
});

const base = `http://127.0.0.1:${server.port}`;

async function inspect(page) {
  return page.evaluate(() => {
    const stage = document.querySelector("[data-shell-stage]");
    const pane = document.querySelector("[data-pane-slot]");
    const layer = pane.querySelector("[data-pane-layer]");
    const canvas = document.querySelector("canvas");

    return {
      x: stage.scrollLeft,
      width: stage.clientWidth,
      deck: document.querySelector("[data-shell-deck]").clientWidth,
      pane: pane.clientWidth,
      clip: layer?.style.clipPath,
      scroll: layer?.scrollTop,
      hold: pane.hasAttribute("data-camera-hold"),
      canvas: [canvas.width, canvas.height],
      count: window.__mobileTest.count,
      camera: window.__mobileTest.camera,
      galleryWidth: document.querySelector("[data-gallery]").getBoundingClientRect().width,
      gpuErrors: window.__mobileTest.errors,
    };
  });
}

async function checkNavigation(type, name) {
  const options = { headless: true };

  if (name === "chromium") {
    options.channel = "chromium";
    options.args = ["--enable-unsafe-webgpu"];
  }

  const browser = await type.launch(options);

  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    await context.addInitScript(() => {
      window.__mobileTest = { count: 0, errors: [] };

      if (!window.GPUAdapter) return;

      const requestDevice = GPUAdapter.prototype.requestDevice;

      GPUAdapter.prototype.requestDevice = async function (...args) {
        const device = await requestDevice.apply(this, args);

        device.addEventListener("uncapturederror", (event) => window.__mobileTest.errors.push(event.error.message));

        return device;
      };

      const draw = GPURenderPassEncoder.prototype.draw;

      const write = GPUQueue.prototype.writeBuffer;
      const uniforms = new WeakMap();

      GPUQueue.prototype.writeBuffer = function (buffer, offset, data, dataOffset = 0, size) {
        if ((buffer.usage & GPUBufferUsage.UNIFORM) && buffer.size === 208) {
          const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          const unit = data.BYTES_PER_ELEMENT ?? 1;
          const saved = uniforms.get(buffer) ?? new Uint8Array(buffer.size);
          const start = dataOffset * unit;

          saved.set(bytes.subarray(start, size === undefined ? bytes.length : start + size * unit), offset);
          uniforms.set(buffer, saved);
          window.__mobileTest.camera = Array.from(new Float32Array(saved.buffer).subarray(48, 52));
        }

        return write.call(this, buffer, offset, data, dataOffset, size);
      };

      GPURenderPassEncoder.prototype.draw = function (...args) {
        window.__mobileTest.count = args[1];

        return draw.apply(this, args);
      };
    });

    const page = await context.newPage();
    const errors = [];

    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/");

    if (name === "chromium") await page.waitForFunction(() => document.querySelector("canvas").classList.contains("is-live"));

    await page.locator('[data-deck-link="work"]').tap();
    await page.waitForTimeout(350);

    const partial = await inspect(page);

    assert.ok(partial.clip?.startsWith("polygon"), "mobile reveal must remain animated");
    assert.ok(partial.x > 0 && partial.x < 275, "camera must travel with the reveal");
    await page.waitForTimeout(1700);

    const opened = await inspect(page);

    assert.ok(Math.abs(opened.x - 275) <= 1);
    assert.equal(opened.deck, 300);
    assert.equal(opened.clip, "");

    if (name === "chromium") {
      assert.equal(opened.count, 3952);
      assert.deepEqual(opened.canvas, [370, 804], "canvas must stay viewport-sized");
      assert.equal(opened.camera[0], 275);
      assert.equal(opened.camera[1], 912);

      const session = await context.newCDPSession(page);

      async function touch(type, x, y) {
        await session.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
      }

      await touch("touchStart", 245, 420);

      for (let step = 1; step <= 6; step++) {
        await touch("touchMove", 245 - step * 10, 420);
        await page.waitForTimeout(35);
      }

      await page.waitForTimeout(130);
      await touch("touchEnd");
      await page.waitForTimeout(1000);
      assert.ok(Math.abs((await inspect(page)).x - 335) <= 2, "drag must not snap back");
      assert.ok(Math.abs((await inspect(page)).camera[0] - 335) <= 2, "GPU must follow the same camera");
      await touch("touchStart", 150, 600);

      for (let step = 1; step <= 7; step++) {
        await touch("touchMove", 150, 600 - step * 45);
        await page.waitForTimeout(25);
      }

      await touch("touchEnd");
      await page.waitForTimeout(350);
      assert.ok((await inspect(page)).scroll > 200, "vertical input must scroll the article");
    } else {
      // Mobile WebKit has no wheel/drag automation; set the same free camera position.
      await page.evaluate(() => { document.querySelector("[data-shell-stage]").scrollLeft += 60; });
    }

    const beforeHeight = await inspect(page);

    await page.setViewportSize({ width: 390, height: 744 });
    await page.waitForTimeout(250);
    assert.equal((await inspect(page)).x, beforeHeight.x, "browser chrome must not reanchor the camera");
    await page.evaluate(() => {
      window.__closeTrace = [];

      const start = performance.now();

      function sample() {
        window.__closeTrace.push({ x: document.querySelector("[data-shell-stage]").scrollLeft, time: performance.now() });

        if (performance.now() - start < 2200) requestAnimationFrame(sample);
      }

      requestAnimationFrame(sample);
    });
    await page.locator("[data-pane-close]").tap();
    await page.waitForTimeout(2300);

    const closed = await inspect(page);
    const trace = await page.evaluate(() => window.__closeTrace);

    assert.equal(closed.x, 0);
    assert.equal(closed.hold, false);
    assert.equal(closed.pane, 0);

    for (let index = 1; index < trace.length; index++) {
      const elapsed = (trace[index].time - trace[index - 1].time) / 1000;

      assert.ok(Math.abs(trace[index].x - trace[index - 1].x) <= elapsed * 400 + 4, "closing must not collapse the column early");
    }

    for (const width of [320, 375, 430, 768, 899, 900]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base + "/about/");
      await page.waitForTimeout(350);

      const state = await inspect(page);

      if (width < 900) {
        assert.equal(state.deck, width === 320 ? 280 : 300);
        assert.equal(state.galleryWidth, 0);
      } else {
        assert.notEqual(state.deck, 300);
        assert.ok(state.galleryWidth > 0);
      }

      if (width >= 768) assert.equal(state.x, 0);

      assert.deepEqual(state.gpuErrors, []);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/about/");
    await page.locator("[data-pane-close]").tap();
    await page.waitForTimeout(120);
    await page.evaluate(() => document.querySelector('[data-deck-link="work"]').click());
    await page.waitForTimeout(2000);
    assert.equal(await page.locator("[data-pane-layer]").count(), 1);
    assert.equal(await page.locator('[data-pane="work"]').count(), 1);
    await page.goBack();
    await page.waitForTimeout(1800);
    await page.goForward();
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('[data-pane="work"]').count(), 1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base + "/about/");
    await page.waitForTimeout(150);
    assert.equal((await inspect(page)).clip, "");
    await page.locator("[data-pane-close]").tap();
    await page.waitForTimeout(150);
    assert.equal((await inspect(page)).x, 0);
    assert.deepEqual(errors, []);
    assert.deepEqual((await inspect(page)).gpuErrors, []);
    console.log(`${name}: mobile navigation regressions passed`);
    await context.close();
  } finally {
    await browser.close();
  }
}

try {
  await checkNavigation(chromium, "chromium");
  await checkNavigation(webkit, "webkit");
} finally {
  server.stop(true);
}
