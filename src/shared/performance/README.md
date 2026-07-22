# Bundle performance budget

Run the guard after a production build:

```sh
node scripts/check-bundle-budget.mjs
node scripts/check-bundle-budget.mjs --json
```

The command recursively measures JavaScript and CSS files under `dist/assets`.
It reports total and largest-chunk sizes as both raw bytes and deterministic
Node `gzipSync` bytes. Missing or empty output is an error, so a skipped build
cannot be mistaken for a pass.

## Baseline and limits

The baseline was measured from the latest `main` production output on
2026-07-22. Total-size limits leave roughly five percent for incremental shared UI work.
The largest CSS chunk allows 6.6 percent raw and 7.9 percent gzip for the shared token and control layer;
going beyond either threshold requires an explicit code-splitting or asset-size review.

| Asset | Metric | Baseline | Budget | Headroom |
| --- | --- | ---: | ---: | ---: |
| JS | total raw | 1,241,134 B | 1,304,000 B | 5.1% |
| JS | total gzip | 414,134 B | 435,000 B | 5.1% |
| JS | largest raw chunk | 313,016 B | 329,000 B | 5.1% |
| JS | largest gzip chunk | 98,863 B | 104,000 B | 5.3% |
| CSS | total raw | 575,220 B | 604,000 B | 5.0% |
| CSS | total gzip | 107,446 B | 113,000 B | 5.3% |
| CSS | largest raw chunk | 346,129 B | 369,000 B | 6.6% |
| CSS | largest gzip chunk | 61,191 B | 66,000 B | 7.9% |

Exit code `0` means every metric is within budget, `1` means at least one
budget was exceeded, and `2` means the build output or command arguments were
invalid. Use `--assets-dir <path>` to inspect a non-default output directory.
