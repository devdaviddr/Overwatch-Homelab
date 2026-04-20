# Alerts & Retention

v0.2.0 turns Overwatch into a platform that can answer both "what is happening right now?" and "what happened?". This topic covers how historical metrics, retention, and threshold alerting work together.

## Historical metrics

Every `agent:metrics` push is written to the `MetricSnapshot` table on the hub. The write happens **out-of-band** from the live Socket.IO broadcast, so persistence failures never affect real-time updates.

The **Monitor** tab shows three historical line charts (CPU %, memory %, per-mount disk %) driven by the time-range selector:

| Range | Resolution | Refresh cadence |
|---|---|---|
| 1 h | 1-minute buckets | 30 s |
| 6 h | 5-minute buckets | 30 s |
| 24 h | 5-minute buckets | 5 min |
| 7 d | 1-hour buckets | 5 min |

Bucket values are averages — no min/max/percentile roll-ups in v0.2.0.

The **Summary cards** above the charts show avg CPU (last 1 h), peak memory (last 24 h), and the current worst disk mount.

## Retention

Each resource has its own `retentionDays` (default **30**, range 1–365). Every 6 hours the hub runs a **retention pruner** that batch-deletes snapshots older than this cutoff (1000 rows per iteration).

Change the retention on the **Configuration** tab → "Alerts & retention" card → **Retention (days)** field.

> The raw `LabMetrics` payload is stored per snapshot. For long-running labs with many disks or network interfaces, 30 days of storage can grow noticeably — shorten retention if storage is a concern. Roll-up compaction is deferred to v0.3.0.

## Alert thresholds

A resource can fire alerts on three metrics:

- **CPU %** — current overall load
- **Memory %** — `memActiveBytes / memTotalBytes`
- **Disk %** — worst mount point by utilisation

An alert fires when the metric exceeds its threshold **for N consecutive snapshots** (`consecutiveBreaches`, 1–60). This prevents single-reading spikes from paging you.

To configure: **Configuration** tab → "Alerts & retention" card → toggle **Enable alerts** on, set each threshold, save.

Defaults when you first enable: 85 % CPU, 90 % memory, 80 % disk, 3 consecutive readings.

## What happens when an alert fires

1. The hub creates an `Alert` row (`firedAt=now`, `peakValue=current value`).
2. It emits `lab:alert` to the lab's Socket.IO room.
3. Your dashboard shows a red toast at the top-right for 10 seconds.
4. The resource's sidebar icon gets a red pip with the count of active alerts.
5. The **Alerts** tab on the resource detail page shows the alert with status `ACTIVE`.

While the metric stays above the threshold, `peakValue` keeps climbing to track the worst reading seen.

## Resolving and acknowledging

- **Resolve** happens automatically on the next snapshot that goes *below* the threshold. `resolvedAt` is set and `lab:alert-resolved` is emitted.
- **Acknowledge** is a manual action on the **Alerts** tab. Acknowledging an active alert sets `acknowledgedAt` and changes its pill from `ACTIVE` to `ACKNOWLEDGED` — useful when you've already taken action but the condition hasn't resolved yet.

## Delivery limitations (v0.2.0)

Notifications are **in-app only**. No email, SMS, PagerDuty, or webhook integrations — those are scoped for v0.3.0. The Alerts tab and the sidebar badge are the sources of truth; the banner is fire-and-forget.
