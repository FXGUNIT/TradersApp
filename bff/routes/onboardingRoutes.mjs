export function createOnboardingRouteHandler({
  getApplication,
  getApplicationStatus,
  mergeApplicationConsent,
  readJsonBody,
  upsertApplication,
  json,
}) {
  return async function handleOnboardingRoute(req, res, url, origin) {
    if (req.method === "POST" && url.pathname === "/onboarding/applications") {
      const body = await readJsonBody(req, 50_000);
      const uid = String(body.uid || "").trim();

      if (!uid) {
        json(
          res,
          400,
          {
            ok: false,
            error: "uid is required.",
          },
          origin,
        );
        return true;
      }

      const record = upsertApplication(uid, body);
      json(
        res,
        200,
        {
          ok: true,
          application: record,
        },
        origin,
      );
      return true;
    }

    const statusMatch = url.pathname.match(
      /^\/onboarding\/applications\/([^/]+)\/status$/,
    );
    if (req.method === "GET" && statusMatch) {
      const uid = decodeURIComponent(statusMatch[1]);
      const status = getApplicationStatus(uid);

      if (!status) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Application not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          ...status,
        },
        origin,
      );
      return true;
    }

    const applicationMatch = url.pathname.match(
      /^\/onboarding\/applications\/([^/]+)$/,
    );
    if (req.method === "GET" && applicationMatch) {
      const uid = decodeURIComponent(applicationMatch[1]);
      const application = getApplication(uid);

      if (!application) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Application not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          application,
        },
        origin,
      );
      return true;
    }

    const consentMatch = url.pathname.match(
      /^\/onboarding\/applications\/([^/]+)\/consents$/,
    );
    if (req.method === "POST" && consentMatch) {
      const uid = decodeURIComponent(consentMatch[1]);
      const body = await readJsonBody(req, 20_000);
      const application = mergeApplicationConsent(uid, body.consentState);

      if (!application) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Application not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          application,
        },
        origin,
      );
      return true;
    }

    return false;
  };
}

export default createOnboardingRouteHandler;
