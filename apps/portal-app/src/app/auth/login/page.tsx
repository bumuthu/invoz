import { Suspense } from "react";
import AppLoading from "@/components/AppLoading";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <LoginForm />
    </Suspense>
  );
}
