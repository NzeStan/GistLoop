// Runs before the app loads so a saved dark/light choice never flashes the wrong theme.
(function () {
  try {
    var theme = localStorage.getItem("gistloop-theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch (e) {
    /* Storage blocked: follow the system setting. */
  }
})();
