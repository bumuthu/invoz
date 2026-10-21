"use client";

import { useDemo } from "@/components/DemoProvider";

export default function BookDemoButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { openDemo } = useDemo();

  return (
    <button type="button" className={className} onClick={openDemo}>
      {children}
    </button>
  );
}
