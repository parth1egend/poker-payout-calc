import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "Sessions" },
  { to: "/players", label: "Players" },
  { to: "/settings", label: "Backup" }
];

const getTitle = (pathname: string): string => {
  if (pathname.startsWith("/players")) {
    return "Players";
  }

  if (pathname.startsWith("/settings")) {
    return "Backup & Settings";
  }

  if (pathname.includes("/settlement")) {
    return "Settlement";
  }

  if (pathname.includes("/games/")) {
    return "Game Detail";
  }

  if (pathname !== "/") {
    return "Session Detail";
  }

  return "Poker Settlement";
};

export const AppShell = () => {
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Offline-first poker accounting</p>
          <h1>{getTitle(location.pathname)}</h1>
        </div>
      </header>

      <main className="page-shell">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav-link${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
