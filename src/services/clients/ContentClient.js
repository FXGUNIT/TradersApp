import {
  getLocalDocumentMeta,
  getLocalHubContent,
  listLocalDocumentMeta,
} from "../contentCatalog.js";
import {
  fetchDocumentMeta as fetchDocumentMetaGateway,
  fetchDocumentMetaList as fetchDocumentMetaListGateway,
  fetchHubContent as fetchHubContentGateway,
} from "../gateways/contentGateway.js";

export async function getHubContent() {
  const response = await fetchHubContentGateway();
  return response?.content || getLocalHubContent();
}

export function getDocumentMeta(slug) {
  return getLocalDocumentMeta(slug);
}

export async function fetchDocumentMeta(slug) {
  const response = await fetchDocumentMetaGateway(slug);
  return response?.document || getLocalDocumentMeta(slug);
}

export async function listDocumentMeta() {
  const response = await fetchDocumentMetaListGateway();
  return response?.documents || listLocalDocumentMeta();
}

export default {
  fetchDocumentMeta,
  getHubContent,
  getDocumentMeta,
  listDocumentMeta,
};
