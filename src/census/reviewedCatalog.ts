import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CensusVariableMetadata } from './metadata.js';
import { metricCatalog } from './catalog.js';

export type ReviewedMetricDefinition = {
  key: string;
  label: string;
  dataset: string;
  geography: 'county' | 'state';
  variables: [{ id: string; label: string; unit: string }];
  review: { reviewedAt: string; sourceVariable: CensusVariableMetadata };
};

const reviewedMetricsPath = resolve(process.cwd(), '.censense-reviewed-metrics.json');

function loadReviewedMetrics(): ReviewedMetricDefinition[] {
  if (!existsSync(reviewedMetricsPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(reviewedMetricsPath, 'utf8')) as ReviewedMetricDefinition[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const reviewedMetrics = new Map<string, ReviewedMetricDefinition>(loadReviewedMetrics().map((metric) => [metric.key, metric]));

export function registerReviewedMetric(definition: ReviewedMetricDefinition): ReviewedMetricDefinition {
  reviewedMetrics.set(definition.key, definition);
  writeFileSync(reviewedMetricsPath, JSON.stringify([...reviewedMetrics.values()], null, 2), 'utf8');
  return definition;
}

export function getReviewedMetric(key: string): ReviewedMetricDefinition | undefined {
  return reviewedMetrics.get(key);
}

export function getMetricDefinition(key: string): (typeof metricCatalog)[keyof typeof metricCatalog] | ReviewedMetricDefinition | undefined {
  return metricCatalog[key as keyof typeof metricCatalog] ?? reviewedMetrics.get(key);
}

export function getSupportedMetricKeys(): string[] {
  return [...Object.keys(metricCatalog), ...reviewedMetrics.keys()];
}

export function getReviewedMetrics(): ReviewedMetricDefinition[] {
  return [...reviewedMetrics.values()];
}
