/** Subscribe an existing Cesium viewer to the connected twin's observed state. */
export function connectLivingTwin({ Cesium, viewer, endpoint, bbox, matrix, onError = console.error }) {
  const base = new URL(endpoint);
  const controller = new AbortController();
  const source = new Cesium.GeoJsonDataSource("Tri-State living twin");
  let socket;
  let stopped = false;
  let timer;
  let wake;
  const sleep = () => new Promise((resolve) => {
    wake = resolve;
    timer = setTimeout(resolve, 2000);
  });

  async function reload() {
    const url = new URL("/v1/cesium", base);
    url.searchParams.set("bbox", bbox.join(","));
    if (matrix) url.searchParams.set("matrix", matrix);
    const features = [];
    let mark;
    do {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Cesium snapshot HTTP ${response.status}`);
      const page = await response.json();
      features.push(...page.features);
      mark = page.watermark;
      if (!page.next) break;
      for (const [key, value] of Object.entries({
        ...page.next, watermark: mark, valid_at: page.valid_at, known_at: page.known_at,
      })) url.searchParams.set(key, value);
    } while (!stopped);
    if (!stopped) await source.load({ type: "FeatureCollection", features });
    return mark;
  }

  async function watch(after) {
    const url = new URL("/v1/live", base);
    url.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("after", after);
    await new Promise((resolve) => {
      socket = new WebSocket(url);
      socket.onclose = resolve;
      socket.onerror = () => socket.close();
      socket.onmessage = ({ data }) => {
        const { changes } = JSON.parse(data);
        if (changes.some(({ event }) =>
          event.timeline === "observed" && (!matrix || event.matrix === matrix))) socket.close();
      };
    });
  }

  async function run() {
    await viewer.dataSources.add(source);
    if (stopped) viewer.dataSources.remove(source, true);
    while (!stopped) {
      try {
        const cursor = await reload();
        if (!stopped) await watch(cursor);
      } catch (error) {
        if (!stopped) onError(error);
      }
      if (!stopped) await sleep();
    }
  }

  void run().catch(onError);
  return () => {
    stopped = true;
    controller.abort();
    socket?.close();
    clearTimeout(timer);
    wake?.();
    viewer.dataSources.remove(source, true);
  };
}
