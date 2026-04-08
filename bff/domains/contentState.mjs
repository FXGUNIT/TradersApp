import {
  getLocalDocumentMeta,
  getLocalHubContent,
  listLocalDocumentMeta,
} from "../services/contentCatalog.js";

export function getHubContent() {
  return getLocalHubContent();
}

export function getDocumentMeta(slug) {
  return getLocalDocumentMeta(slug);
}

export function listDocumentMeta() {
  return listLocalDocumentMeta();
}

export default {
  getDocumentMeta,
  getHubContent,
  listDocumentMeta,
};
