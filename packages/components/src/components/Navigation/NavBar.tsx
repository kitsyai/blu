import * as React from 'react';
import { Navigate } from "@kitsy/blu-route";

interface MenuLinkAttributes {
  href: string;
  label: string;
  icon: string;
}

function MenuLink({ href, label, icon }: MenuLinkAttributes) {
  return (
    <li className="flex flex-col md:flex-row w-16 sm:w-24 md:w-32 h-8 sm:h-12 md:h-16 p-2 items-center justify-center md:gap-2">
      <Navigate to={href}>
        <i className={`text-sm sm:text fa-solid fa-${icon}`} />
      </Navigate>
      <Navigate to={href}>
        <span className="text-sm sm:text-base font-bold">{label}</span>
      </Navigate>
    </li>
  );
}

export function NavBar() {
  return (
    <div className="fixed bottom-0 md:bottom-5 z-50 flex w-full h-16 sm:justify-center">
      <nav className="flex-grow flex sm:flex-grow-0 bg-slate-50 p-2 sm:justify-center md:shadow-md shadow-inner items-center rounded-lg">
        <ul className="flex flex-grow sm:flex-grow-0 justify-evenly p-2">
          <MenuLink href="/" icon="home" label="Home" />
          <MenuLink href="/blogs" icon="blog" label="Blogs" />
          <MenuLink href="/ai" icon="microchip" label="AI" />
          <MenuLink href="/apps" icon="shapes" label="Apps" />
          <MenuLink href="/gallery" icon="shapes" label="Gallery" />
          <MenuLink href="/guides" icon="clipboard-question" label="Guides" />
          {/* <MenuLink href="/about-me" icon="user" label="About me" /> */}
        </ul>
      </nav>
    </div>
  );
}
