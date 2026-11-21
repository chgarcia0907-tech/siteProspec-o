import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { tasksPipedrive } from "@/lib/tasksHunter.functions";

/** Cards e tasks do Pipedrive para a tela Tasks (o admin recebe todos; o hunter, os próprios). */
export function useTasksPipedrive() {
  const fn = useServerFn(tasksPipedrive);
  return useQuery({
    queryKey: ["tasks_pipedrive"],
    queryFn: () => fn(),
    staleTime: 60_000,
    retry: false,
  });
}
