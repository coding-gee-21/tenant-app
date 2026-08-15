import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { Home, LayoutDashboard, PlusCircle, LogOut, User, Menu, X } from 'lucide-react';

export default function Layout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  // Close sidebar when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        const toggleButton = document.getElementById('sidebar-toggle-btn');
        if (toggleButton && toggleButton.contains(event.target)) {
          return;
        }
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-gray-200 font-sans flex flex-col">
      {/* Global Head for Browser Favicon & Title */}
      <Head>
        <title>Tenant | Direct & Verified Student Housing</title>
        <link rel="icon" href="/logo.png" type="image/png" />
      </Head>

      {/* Top Header with Hamburger Menu Button */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#121215] border-b border-white/10 flex items-center px-6 z-40">
        <button
          id="sidebar-toggle-btn"
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/15 transition text-gray-200 focus:outline-none"
          aria-label="Toggle Sidebar"
        >
          <Menu size={22} />
        </button>
        <Link href="/" className="ml-4 flex items-center gap-3">
          <Image 
            src="/logo.png" 
            alt="Tenant Logo" 
            width={32} 
            height={32} 
            className="rounded-md object-contain"
          />
          <span className="text-2xl font-bold text-[#E8DCC4] tracking-wider">TENANT</span>
        </Link>
      </header>

      {/* Backdrop Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity" />
      )}

      {/* Collapsible Vertical Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-screen w-64 bg-[#121215] border-r border-white/10 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="Tenant Logo" 
              width={28} 
              height={28} 
              className="rounded-md object-contain"
            />
            <span className="text-xl font-bold text-[#E8DCC4] tracking-wider">TENANT</span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-white/5 hover:text-white transition">
            <Home size={20} /> Home
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-white/5 hover:text-white transition">
                <LayoutDashboard size={20} /> Dashboard
              </Link>
              <Link href="/add-property" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-white/5 hover:text-white transition">
                <PlusCircle size={20} /> List Property
              </Link>
            </>
          ) : (
            <Link href="/auth" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-white/5 hover:text-white transition">
              <User size={20} /> Login / Register
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-white/10">
          {user ? (
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition"
            >
              <LogOut size={20} /> Logout
            </button>
          ) : (
            <div className="px-4 py-2 text-xs text-gray-500">
              {new Date().getFullYear()} Tenant. All rights reserved.
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>

        <footer className="mt-12 py-6 text-center text-gray-500 text-sm border-t border-gray-800">
          © {new Date().getFullYear()} Tenant. The smarter way to rent.
        </footer>
      </main>
    </div>
  );
}