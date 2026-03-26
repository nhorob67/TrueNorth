import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-48 bg-line/50 rounded animate-pulse" />
        <p className="font-mono text-[10px] text-faded">Warming up the cockpit...</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <div className="space-y-3 py-4">
                <div className="h-4 w-3/4 bg-line/50 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-line/50 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-line/50 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
