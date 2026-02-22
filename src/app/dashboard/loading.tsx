import { GlobalLoader } from "@/components/ui/global-loader";

export default function DashboardLoading() {
    return (
        <div className="w-full h-[80vh] flex items-center justify-center">
            <GlobalLoader />
        </div>
    );
}
