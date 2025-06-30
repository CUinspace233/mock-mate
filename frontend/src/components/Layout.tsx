import { Outlet } from 'react-router-dom';
// import NavBar from './NavBar.tsx';
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
