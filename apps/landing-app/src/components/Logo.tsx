import logo from "@/assets/invoz-full-small.svg?url";

export default function Logo({ className = "brand-logo" }: { className?: string }) {
  return <img className={className} src={logo} alt="Invoz" />;
}
