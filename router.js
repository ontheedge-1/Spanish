// Hash router: "#/path" => route
export function getRoute() {
  const hash = window.location.hash || "#/";
  const path = hash.replace(/^#/, "") || "/";
  return path;
}

export function setActiveNav(route) {
  document.querySelectorAll(".navlink").forEach(a => {
    const href = a.getAttribute("href") || "";
    const target = href.startsWith("#") ? href.replace(/^#/, "") : href;
    a.classList.toggle("active", target === route);
  });
}

export function mountRoute({ routes, root }) {
  const route = getRoute();
  setActiveNav(route);

  const render = routes[route] || routes["/404"];
  root.innerHTML = "";
  render(root);
}

export function startRouter({ routes, root }) {
  const run = () => mountRoute({ routes, root });

  window.addEventListener("hashchange", run);
  window.addEventListener("load", run);

  // If opened without hash, force "#/"
  if (!window.location.hash) window.location.hash = "#/";
  run();
}
