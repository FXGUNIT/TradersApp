import { bffFetch } from "./base.js";

export async function fetchHubContent() {
  return bffFetch("/content/hub");
}

export async function fetchDocumentMeta(slug) {
  if (!slug) {
    return null;
  }

  return bffFetch(`/content/documents/${encodeURIComponent(slug)}`);
}

export async function fetchDocumentMetaList() {
  return bffFetch("/content/documents");
}

export default {
  fetchDocumentMeta,
  fetchDocumentMetaList,
  fetchHubContent,
};
