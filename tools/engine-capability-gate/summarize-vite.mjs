#!/usr/bin/env node
/** Descriptive sample statistics for run.mjs reports; no percentage pass threshold. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2), outputIndex = args.indexOf('--out');
const output = outputIndex < 0 ? undefined : args.splice(outputIndex, 2)[1];
if (!args.length || outputIndex >= 0 && !output) throw new Error('Usage: summarize-vite.mjs <runs.json...> [--out summary.json]');
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2;
};
const distribution = values => ({ samples: values.length, median: median(values), mean: mean(values), min: Math.min(...values), max: Math.max(...values) });
const contrast = (base, candidate) => ({ base: distribution(base), candidate: distribution(candidate), medianDeltaPercent: (median(candidate) / median(base) - 1) * 100 });
const reports = args.map(path => {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (data.interrupted || !Array.isArray(data.behaviorMismatches)) throw new Error(`Exclude incomplete or interrupted report: ${path}`);
  return { path, data };
});
const samples = reports.flatMap(report => report.data.rows);
const identityFields = ['frozenDigest', 'measuredStartDigest', 'digest', 'wireDigest', 'wireBytes', 'snapshotBytes'];
const scenarios = [...new Set(samples.map(row => `${row.workload}/${row.freezeTicks}/${row.measured}`))];
const identity = scenarios.map(scenario => ({ scenario,
  fields: Object.fromEntries(identityFields.map(field => {
    const values = [...new Set(samples.filter(row => `${row.workload}/${row.freezeTicks}/${row.measured}` === scenario).map(row => row[field]))];
    return [field, { identical: values.length === 1, values }];
  })),
}));
const result = {
  createdAt: new Date().toISOString(),
  note: 'Descriptive statistics across fresh-browser samples, without a percentage tolerance or automatic performance pass. Tick percentiles are summarized per sample; they are not independent browser observations. FNV digests are behavioral witnesses, not cryptographic identity.',
  samples: samples.length,
  identity,
  reports: reports.map(({ path, data }) => ({ source: path, options: data.options, buildCreatedAt: data.build.createdAt,
    bundles: Object.fromEntries(['base', 'candidate'].map(variant => {
      const graph = data.build.variants[variant].graph;
      return [variant, { head: data.build.variants[variant].head, workingTreeIncluded: data.build.variants[variant].workingTreeIncluded,
        entryBytes: graph.filter(chunk => chunk.entry).reduce((sum, chunk) => sum + chunk.bytes, 0),
        entryModules: graph.filter(chunk => chunk.entry).flatMap(chunk => chunk.modules) }];
    })),
    workloads: data.options.workloads.map(workload => {
      const rows = data.rows.filter(row => row.workload === workload);
      const comparison = rows.filter(row => row.group === 'comparison'), controls = rows.filter(row => row.group === 'AA');
      return { workload, comparisonSamples: comparison.length, controlSamples: controls.length,
        metrics: Object.fromEntries(['sim', 'replication'].map(metric => [metric, {
          comparison: Object.fromEntries(['mean', 'p50', 'p95', 'p99'].map(stat => [stat, contrast(
            comparison.filter(row => row.variant === 'base').map(row => row[metric][stat]),
            comparison.filter(row => row.variant === 'candidate').map(row => row[metric][stat]))])),
          aaMean: controls.length ? contrast(controls.filter(row => row.label === 'A').map(row => row[metric].mean), controls.filter(row => row.label === 'B').map(row => row[metric].mean)) : null,
          aaPercentiles: controls.length ? Object.fromEntries(['p95', 'p99'].map(stat => [stat, contrast(
            controls.filter(row => row.label === 'A').map(row => row[metric][stat]),
            controls.filter(row => row.label === 'B').map(row => row[metric][stat]))])) : null,
          balancedRounds: [...new Set(comparison.map(row => row.round))].map(round => {
            const selected = comparison.filter(row => row.round === round);
            const base = mean(selected.filter(row => row.variant === 'base').map(row => row[metric].mean));
            const candidate = mean(selected.filter(row => row.variant === 'candidate').map(row => row[metric].mean));
            return { round, base, candidate, deltaPercent: (candidate / base - 1) * 100 };
          }),
          balancedTailRounds: Object.fromEntries(['p95', 'p99'].map(stat => [stat,
            [...new Set(comparison.map(row => row.round))].map(round => {
              const selected = comparison.filter(row => row.round === round);
              const base = mean(selected.filter(row => row.variant === 'base').map(row => row[metric][stat]));
              const candidate = mean(selected.filter(row => row.variant === 'candidate').map(row => row[metric][stat]));
              return { round, base, candidate, deltaPercent: (candidate / base - 1) * 100 };
            }),
          ])),
        }])),
        resourcePaths: [...new Set(rows.flatMap(row => row.resourcePaths))],
      };
    }),
  })),
  sourceReportHashes: reports.map(({ path }) => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') })),
};
const text = JSON.stringify(result, null, 2) + '\n';
if (output) writeFileSync(resolve(output), text); else process.stdout.write(text);
if (identity.some(workload => Object.values(workload.fields).some(field => !field.identical))) process.exitCode = 1;
