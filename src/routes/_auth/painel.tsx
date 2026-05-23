import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/painel")({
  beforeLoad: () => {
    throw redirect({ to: "/registros", replace: true });
  },
  component: () => null,
});
