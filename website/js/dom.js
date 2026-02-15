export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else if (k === "html") node.innerHTML = String(v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset" && v && typeof v === "object") {
      for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = String(dv);
    } else node.setAttribute(k, String(v));
  }
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((c) => node.append(c.nodeType ? c : document.createTextNode(String(c))));
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function safeText(v) {
  if (v == null) return "";
  return String(v);
}

