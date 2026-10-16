import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const path = process.argv[2];
if (!path) throw new Error('Pass browser-runs.json');
const rows = JSON.parse(readFileSync(path, 'utf8'));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const summary = [...new Set(rows.map(r => r.workload))].map(workload => {
  const byVariant = Object.fromEntries(['base', 'candidate'].map(v => [v, rows.filter(r => r.workload === workload && r.variant === v)]));
  const fields = ['digest', 'wireDigest', 'snapshotBytes', 'joinBytes', 'wireBytes', 'entKeys', 'gameKeys', 'stateKeys'];
  const identity = Object.fromEntries(fields.map(key => [key, new Set([...byVariant.base, ...byVariant.candidate].map(r => JSON.stringify(r[key]))).size === 1]));
  const metrics = Object.fromEntries(['sim', 'replication', 'save', 'load'].map(metric => {
    const stats = Object.fromEntries(['mean', 'p50', 'p95', 'p99'].map(stat => {
      const base = mean(byVariant.base.map(r => r[metric][stat]));
      const candidate = mean(byVariant.candidate.map(r => r[metric][stat]));
      return [stat, { base, candidate, deltaPercent: (candidate / base - 1) * 100 }];
    }));
    return [metric, stats];
  }));
  return { workload, samplesPerVariant: byVariant.base.length, warmup: rows[0].warmup, measured: rows[0].measured, identity, metrics };
});
const result = { source: resolve(path), note: 'Descriptive statistics only; no tolerance or automatic performance pass. FNV digests are behavioral witnesses, not cryptographic identity.', workloads: summary };
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n');
else console.log(JSON.stringify(result, null, 2));
