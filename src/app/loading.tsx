import { GlobalLoader } from "@/components/ui/global-loader";

export default function Loading() {
    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[10000] flex items-center justify-center">
            <GlobalLoader />
        </div>
    );
}
