export function createContentRouteHandler({
  getHubContent,
  getDocumentMeta,
  listDocumentMeta,
  json,
}) {
  return function handleContentRoute(req, res, url, origin) {
    if (req.method === "GET" && url.pathname === "/content/hub") {
      json(
        res,
        200,
        {
          ok: true,
          content: getHubContent(),
        },
        origin,
      );
      return true;
    }

    if (req.method === "GET" && url.pathname === "/content/documents") {
      json(
        res,
        200,
        {
          ok: true,
          documents: listDocumentMeta(),
        },
        origin,
      );
      return true;
    }

    const documentMatch = url.pathname.match(/^\/content\/documents\/([^/]+)$/);
    if (req.method === "GET" && documentMatch) {
      const slug = decodeURIComponent(documentMatch[1]);
      const document = getDocumentMeta(slug);

      if (!document) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Document not found.",
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
          document,
        },
        origin,
      );
      return true;
    }

    return false;
  };
}

export default createContentRouteHandler;
