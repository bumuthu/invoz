import logo from "@/assets/invoz-full-small.svg?url";

export default function Logo({ height = 36 }: { height?: number }) {
  return <img src={logo} alt="Invoz" style={{ display: "block", height, width: "auto" }} />;
}
