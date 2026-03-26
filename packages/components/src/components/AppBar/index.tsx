import { Navigate } from '@kitsy/blu-route';
import * as React from 'react';

export function AppBar({ text }: {text: string}): React.JSX.Element {
  return (
    <nav className="fixed z-50 top-0 w-full flex bg-slate-50 justify-between shadow-lg h-12 lg:h-16 items-center">
      <div className="w-1/3">
        <Navigate to="/">
          <i className="ml-8 md:ml-24 lg:ml-32 text-lg md:text-2xl fa-solid fa-left-long" />
        </Navigate>
      </div>
      <div className="flex justify-center w-1/3">
        <span>{text}</span>
      </div>
      <div className="w-1/3" />
    </nav>
  );
}

