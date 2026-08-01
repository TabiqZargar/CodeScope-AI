import { CodeScopePlayground } from "@/components/code-scope-playground";

export const metadata = {
  title: "Playground · CodeScope AI",
  description:
    "Step through an immutable trace of your JavaScript — variables, call stack, heap, and execution graph.",
};

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ example?: string }>;
}) {
  const params = await searchParams;
  return <CodeScopePlayground initialExampleId={params.example} />;
}
