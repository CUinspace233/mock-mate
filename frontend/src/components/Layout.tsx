import { Outlet } from "react-router-dom";

function Layout() {
  return (
    <div>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
