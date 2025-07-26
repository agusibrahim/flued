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
    width="737.551" height="436.025" viewBox="0 0 737.551 436.025" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient x1="-.129%" y1="73.064%" x2="84.023%" y2="38.931%" id="a">
      <stop offset="0%"/>
      <stop offset="100%"/>
    </linearGradient>
  </defs>
  <g fill="none">
    <path d="m86.54 276.2 57.66 58.11 158.64-159.88H187.49zM187.49 0h115.35L57.7 247.13 0 189z" fill="#5CC8F8" transform="translate(183.775 36.342)"/>
    <path fill="#075B9D" d="m144.2 334.31 43.29 43.59h115.35L201.89 276.2z" transform="translate(183.775 36.342)"/>
    <path fill="url(#a)" d="m229.76 304.47-27.87-28.27-57.69 58.11z" transform="translate(183.775 36.342)"/>
    <path fill="#16B9FD" d="M86.54 276.18 144.23 218l57.7 58.15-57.7 58.16z" transform="translate(183.775 36.342)"/>
    <path d="M195.55 436.025v-44.683h-24.263c-34.834 0-41.8-8.168-41.8-48.528V276.99c0-33.152-24.264-54.773-69.669-56.695v-4.324c45.405-1.922 69.668-23.784 69.668-56.696V93.211c0-40.36 6.967-48.527 41.801-48.527h24.264V0h-36.276C94.172 0 73.271 20.66 73.271 84.563v53.332c0 37.716-18.978 55.253-73.271 51.65v57.176c54.293-3.604 73.271 13.933 73.271 51.41v53.332c0 63.902 20.9 84.562 86.004 84.562zm346.45 0h36.275c65.104 0 86.004-20.66 86.004-84.562V298.13c0-37.477 18.979-55.014 73.272-51.41v-57.176c-54.293 3.603-73.272-13.934-73.272-51.65V84.562C664.28 20.66 643.38 0 578.275 0H542v44.684h24.264c34.834 0 41.8 8.168 41.8 48.527v66.064c0 32.912 24.264 54.774 69.668 56.696v4.324c-45.404 1.922-69.668 23.543-69.668 56.695v65.824c0 40.36-6.966 48.528-41.8 48.528H542z" fill="#075B9D"/>
  </g>
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