import LoginSecurityMetric from "../auth/login-security-metric.model.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function getAdminLoginSecurityMetrics(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const to = new Date();
  const from = new Date(to.getTime() - WINDOW_MS);
  const firstBucket = new Date(Math.floor(to.getTime() / 3600000) * 3600000 - 23 * 3600000);
  const buckets = await LoginSecurityMetric.find({
    bucketStart: { $gte: firstBucket, $lte: to },
  }).sort({ bucketStart: 1 }).lean();
  const totals = buckets.reduce((sum, item) => ({
    loginSuccesses: sum.loginSuccesses + item.loginSuccesses,
    loginFailures: sum.loginFailures + item.loginFailures,
    knownAccountFailures: sum.knownAccountFailures + item.knownAccountFailures,
  }), { loginSuccesses: 0, loginFailures: 0, knownAccountFailures: 0 });
  return response.json({
    data: {
      from: from.toISOString(),
      to: to.toISOString(),
      totals,
      buckets: buckets.map((item) => ({
        hour: item.bucketStart.toISOString(),
        loginSuccesses: item.loginSuccesses,
        loginFailures: item.loginFailures,
        knownAccountFailures: item.knownAccountFailures,
      })),
    },
  });
}
