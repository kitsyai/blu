import * as React from 'react';

export interface ContainerAttributes {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  width?: string;
  height?: string;
}

export function Container(props: ContainerAttributes) {
  const { children, className } = props;
  
  return <div className={`px-2 md:px-8 ${className}`}>{children}</div>;
}

export function FluidContainer(props: ContainerAttributes) {
  const { children, className } = props;
  
  return <div className={`w-screen max-w-full min-h-screen ${className ?? ''}`}>{children}</div>;
}

export function FullScreenContainer(props: ContainerAttributes) {
  const { children, className } = props;
  return <div className={`w-screen max-w-full h-screen ${className}`}>{children}</div>;
}