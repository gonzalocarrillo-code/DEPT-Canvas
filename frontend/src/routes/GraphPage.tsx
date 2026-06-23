import { useParams } from "react-router";
import { IdeationGraph } from "@/graph/IdeationGraph";

export function GraphPage() {
  const { projectId } = useParams();
  return <IdeationGraph projectId={projectId ?? "demo"} />;
}
