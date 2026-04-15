import { query } from '../db';

export type MetricRow = {
  date: Date;
  metric_name: string;
  metric_value: number;
  dimensions: Record<string, string>;
};

/**
 * Record a metric value for a specific date, name, and dimensions.
 * If a metric already exists for the same combination, adds the new value to the existing value.
 * Never throws - logs errors and continues silently.
 */
export async function recordMetric(
  date: Date,
  name: string,
  value: number,
  dimensions: Record<string, string> = {}
): Promise<void> {
  const sql = `
    INSERT INTO daily_metrics (date, metric_name, metric_value, dimensions)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (date, metric_name, dimensions)
    DO UPDATE SET metric_value = daily_metrics.metric_value + EXCLUDED.metric_value
  `;

  const params = [
    date.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
    name,
    value,
    JSON.stringify(dimensions)
  ];

  try {
    await query(sql, params);
  } catch (error) {
    console.error('[MetricsRepo] Failed to record metric:', error, { date, name, value, dimensions });
  }
}

/**
 * Get metrics for a specific name within a date range.
 * Returns empty array if no results found.
 * Never throws.
 */
export async function getMetrics(
  name: string,
  startDate: Date,
  endDate: Date
): Promise<MetricRow[]> {
  const sql = `
    SELECT date, metric_name, metric_value, dimensions
    FROM daily_metrics
    WHERE metric_name = $1
      AND date BETWEEN $2 AND $3
    ORDER BY date ASC
  `;

  const params = [
    name,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  ];

  try {
    const result = await query(sql, params);
    return result.rows.map(row => ({
      date: new Date(row.date),
      metric_name: row.metric_name,
      metric_value: parseFloat(row.metric_value),
      dimensions: row.dimensions || {}
    }));
  } catch (error) {
    console.error('[MetricsRepo] Failed to get metrics:', error, { name, startDate, endDate });
    return [];
  }
}

/**
 * Get metrics for a specific name and dimension filter within a date range.
 * Uses the @> operator to check if stored dimensions contain all specified key-value pairs.
 * Returns empty array if no results found.
 * Never throws.
 */
export async function getMetricsByDimension(
  name: string,
  dimension: Record<string, string>,
  startDate: Date,
  endDate: Date
): Promise<MetricRow[]> {
  const sql = `
    SELECT date, metric_name, metric_value, dimensions
    FROM daily_metrics
    WHERE metric_name = $1
      AND dimensions @> $2::jsonb
      AND date BETWEEN $3 AND $4
    ORDER BY date ASC
  `;

  const params = [
    name,
    JSON.stringify(dimension),
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  ];

  try {
    const result = await query(sql, params);
    return result.rows.map(row => ({
      date: new Date(row.date),
      metric_name: row.metric_name,
      metric_value: parseFloat(row.metric_value),
      dimensions: row.dimensions || {}
    }));
  } catch (error) {
    console.error('[MetricsRepo] Failed to get metrics by dimension:', error, {
      name, dimension, startDate, endDate
    });
    return [];
  }
}