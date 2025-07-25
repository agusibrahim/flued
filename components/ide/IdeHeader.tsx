"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/theme-toggle"
import { appSamples } from "@/lib/samples"
import { AlertCircle, CheckCircle, Play, RefreshCw, Sparkles } from "lucide-react"
import { DartAnalysisResult } from "@/app/page"

const FlutterLogo = ({ className }: { className?: string }) => (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Flutter"
      viewBox="0 0 512 512"
    >
      <defs>
        <linearGradient id="a" x1="249" x2="321" y1="401" y2="358" gradientUnits="userSpaceOnUse">
          <stop stopOpacity=".4" />
          <stop stopColor="#124793" stopOpacity="0" offset="1" />
        </linearGradient>
      </defs>
      <path d="M191.45 342.89 249.11 401l158.64-159.88H292.4ZM292.4 66.69h115.35L162.61 313.82l-57.7-58.13Z" fill="#5cc8f8" />
      <path fill="#075b9d" d="m249.11 401 43.29 43.59h115.35L306.8 342.89Z" />
      <path d="m334.67 371.16-27.87-28.27L249.11 401Z" fill="url(#a)" />
      <path d="m191.45 342.87 57.69-58.18 57.7 58.15-57.7 58.16Z" fill="#16b9fd" />
    </svg>
  );

interface HeaderProps {
    isAnalyzing: boolean;
    analysisResult: DartAnalysisResult | null;
    onSampleSelect: (value: string) => void;
    onGenerateClick: () => void;
    onRunClick: () => void;
    onHotReloadClick: () => void;
    isCompiling: boolean;
    hasHotReload: boolean;
    lastCompiledCode: string;
    dartCode: string;
}

export function IdeHeader({
    isAnalyzing,
    analysisResult,
    onSampleSelect,
    onGenerateClick,
    onRunClick,
    onHotReloadClick,
    isCompiling,
    hasHotReload,
    lastCompiledCode,
    dartCode,
}: HeaderProps) {
    const errorCount = analysisResult?.issues.filter((issue) => issue.kind === "error").length || 0
    const warningCount = analysisResult?.issues.filter((issue) => issue.kind === "warning").length || 0

    return (
        <div className="bg-card border-b border-border px-4 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
                <div className="flex items-center gap-2">
                    <FlutterLogo className="w-6 h-6" />
                    <h1 className="text-foreground font-semibold text-base md:text-lg">Flued</h1>
                </div>
                <Separator orientation="vertical" className="h-4 md:h-6 bg-border hidden sm:block" />
                <span className="text-muted-foreground text-xs md:text-sm hidden sm:block">
                    v1.0.0
                </span>
                <ModeToggle />
                <Select onValueChange={onSampleSelect}>
                    <SelectTrigger className="w-[180px] h-9 text-xs bg-card border-border hover:bg-accent focus:ring-primary">
                        <SelectValue placeholder="Examples" />
                    </SelectTrigger>
                    <SelectContent>
                        {appSamples.map((sample) => (
                            <SelectItem key={sample.title} value={sample.title}>
                                {sample.title}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
                <div className="flex items-center gap-1 mr-2">
                    {isAnalyzing ? (
                        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>
                    ) : analysisResult ? (
                        <>
                            {errorCount > 0 && (
                                <div className="flex items-center gap-1 text-destructive">
                                    <AlertCircle className="w-3 h-3" />
                                    <span className="text-xs">{errorCount}</span>
                                </div>
                            )}
                            {warningCount > 0 && (
                                <div className="flex items-center gap-1 text-yellow-400">
                                    <AlertCircle className="w-3 h-3" />
                                    <span className="text-xs">{warningCount}</span>
                                </div>
                            )}
                            {errorCount === 0 && warningCount === 0 && <CheckCircle className="w-3 h-3 text-green-400" />}
                        </>
                    ) : null}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onGenerateClick}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 md:px-3"
                    title="Generate Code with AI"
                >
                    <Sparkles className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                    <span className="hidden md:inline">Generate</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRunClick}
                    disabled={isCompiling}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 md:px-3"
                    title="Run Code"
                >
                    {isCompiling ? (
                        <div className="w-3 h-3 md:w-4 md:h-4 border border-current border-t-transparent rounded-full animate-spin md:mr-1" />
                    ) : (
                        <Play className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                    )}
                    <span className="hidden md:inline">Run</span>
                </Button>
                {hasHotReload ? (
                    <Button variant="ghost" size="sm" onClick={onHotReloadClick} disabled={isCompiling || dartCode === lastCompiledCode} className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 md:px-3" title="Hot Reload">
                        {isCompiling ? <div className="w-3 h-3 md:w-4 md:h-4 border border-current border-t-transparent rounded-full animate-spin md:mr-1" /> : <RefreshCw className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />}
                        <span className="hidden md:inline">Hot Reload</span>
                    </Button>
                ) : null}
            </div>
        </div>
    );
}