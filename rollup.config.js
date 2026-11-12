import deckyPlugin from "@decky/rollup";
import replace from "@rollup/plugin-replace";

// DECKY_BUILDS_MOCK=1 swaps the Python backend for an in-memory mock built from
// the example guides, so the UI can be tried on a Deck before the backend exists.
const useMock = process.env.DECKY_BUILDS_MOCK === "1";

export default deckyPlugin({
  plugins: [
    replace({
      preventAssignment: true,
      __DECKY_BUILDS_MOCK__: JSON.stringify(useMock),
    }),
  ],
});
