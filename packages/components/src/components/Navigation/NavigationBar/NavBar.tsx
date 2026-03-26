import React from "react";
import "./navbar.css";
import { Navigate } from "@kitsy/blu-route";

export interface MenuLinkAttributes {
  href: string;
  label: string;
  icon: string; // string hi rakhenge, chahe emoji ho ya icon class
  className?: string; // 👈 extra
  style?: React.CSSProperties; // 👈 extra
}

function MenuLink({
  href,
  label,
  icon,
  className = "",
  style,
}: MenuLinkAttributes) {
  return (
    <li className={`menu-link ${className}`} style={style}>
      <Navigate to={href} className="menu-item">
        <span className="menu-icon">{icon}</span>
        <span className="menu-label">{label}</span>
      </Navigate>
    </li>
  );
}

export interface NavBarProps {
  position?: "top" | "bottom";
  links: MenuLinkAttributes[];
  className?: string;
  style?: React.CSSProperties;
  logo?: string;
  logoAlt?: string;
}

export function NavBar({
  position = "bottom",
  links,
  logo,
  logoAlt = "Logo",
  className = "",
  style,
}: NavBarProps) {
  return (
    <div
      className={`navbar-container navbar-${position} ${className}`}
      style={style}
    >
      <nav className="navbar">
        {logo && (
          <div className="navbar-logo">
            <a href="/">
              <img src={logo} alt={logoAlt} />
            </a>
          </div>
        )}
        <ul className="menu">
          {links?.map((link, i) => (
            <MenuLink key={i} {...link} />
          ))}
        </ul>
      </nav>
    </div>
  );
}
