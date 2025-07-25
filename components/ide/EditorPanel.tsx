"use client"

import Editor from "@monaco-editor/react"
import { useTheme } from "next-themes"
import type { editor } from "monaco-editor"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { Trash2, ChevronDown, Sparkles, Paperclip, X, Check, Undo } from "lucide-react"

interface EditorPanelProps {
    dartCode: string
    handleEditorChange: (value: string | undefined) => void
    handleEditorDidMount: (editor: editor.IStandaloneCodeEditor, monaco: any) => void
    wordWrap: "on" | "off"
    isLogsExpanded: boolean
    logs: { type: string; message: string }[]
    setLogs: React.Dispatch<React.SetStateAction<{ type: string; message: string }[]>>
    setIsLogsExpanded: React.Dispatch<React.SetStateAction<boolean>>
    setLogsHeight: React.Dispatch<React.SetStateAction<number>>
    isAiLoading: boolean
    aiPromptConfig: { visible: boolean; mode: 'modification' | 'generation' | null; }
    setAiPromptConfig: React.Dispatch<React.SetStateAction<{ visible: boolean; mode: 'modification' | 'generation' | null; }>>
    aiPrompt: string
    setAiPrompt: React.Dispatch<React.SetStateAction<string>>
    handleAiModification: () => void
    handleAiGeneration: () => void
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
    attachedFiles: File[]
    setAttachedFiles: React.Dispatch<React.SetStateAction<File[]>>
    aiInteractionResult: { originalCode: string; newCode: string } | null
    setAiInteractionResult: React.Dispatch<React.SetStateAction<{ originalCode: string; newCode: string } | null>>
    setDartCode: React.Dispatch<React.SetStateAction<string>>
}

export function EditorPanel({
    dartCode,
    handleEditorChange,
    handleEditorDidMount,
    wordWrap,
    isLogsExpanded,
    logs,
    setLogs,
    setIsLogsExpanded,
    setLogsHeight,
    isAiLoading,
    aiPromptConfig,
    setAiPromptConfig,
    aiPrompt,
    setAiPrompt,
    handleAiModification,
    handleAiGeneration,
    handleFileSelect,
    attachedFiles,
    setAttachedFiles,
    aiInteractionResult,
    setAiInteractionResult,
    setDartCode
}: EditorPanelProps) {
    const { theme } = useTheme()

    return (
        <div className="h-full flex flex-col bg-background relative">
            <ResizablePanelGroup direction="vertical" className="flex-1">
                <ResizablePanel defaultSize={isLogsExpanded ? 70 : 100} minSize={30}>
                    <div className="h-full overflow-y-auto">
                        <Editor
                            height="100%"
                            defaultLanguage="dart"
                            value={dartCode}
                            onChange={handleEditorChange}
                            onMount={handleEditorDidMount}
                            theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
                            options={{
                                fontSize: 14,
                                fontFamily: "JetBrains Mono, Fira Code, Monaco, monospace",
                                lineNumbers: "on",
                                roundedSelection: false,
                                scrollBeyondLastLine: true,
                                automaticLayout: true,
                                minimap: { enabled: true },
                                wordWrap: wordWrap,
                                tabSize: 2,
                                insertSpaces: true,
                                renderWhitespace: "selection",
                                bracketPairColorization: { enabled: true },
                                guides: {
                                    bracketPairs: true,
                                    indentation: true,
                                },
                                renderValidationDecorations: "on",
                                showUnused: true,
                                accessibilitySupport: "auto",
                                contextmenu: true,
                                quickSuggestions: {
                                    other: true,
                                    comments: false,
                                    strings: false,
                                },
                                suggestOnTriggerCharacters: true,
                                acceptSuggestionOnCommitCharacter: true,
                                acceptSuggestionOnEnter: "on",
                                wordBasedSuggestions: "off",
                                suggest: {
                                    showKeywords: true,
                                    showSnippets: true,
                                    showClasses: true,
                                    showFunctions: true,
                                    showVariables: true,
                                    showModules: true,
                                    showProperties: true,
                                    showMethods: true,
                                },
                                lightbulb: {
                                    enabled: undefined,
                                },
                            }}
                        />
                    </div>
                </ResizablePanel>

                {isLogsExpanded && (
                    <>
                        <ResizableHandle className="bg-border hover:bg-accent active:bg-primary transition-colors" />
                        <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
                            <div className="h-full bg-card flex flex-col">
                                <div className="bg-muted px-3 py-2 flex items-center justify-between border-b border-border">
                                    <span className="text-foreground text-sm font-medium">Logs</span>
                                    <div className="flex items-center gap-2">
                                        {logs.length > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setLogs([])}
                                                className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-1 h-auto"
                                                title="Clear Logs"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setIsLogsExpanded(false)
                                                setLogsHeight(0)
                                            }}
                                            className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-1 h-auto"
                                            title="Collapse Logs"
                                        >
                                            <ChevronDown className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-2 bg-background">
                                    {logs.length === 0 ? (
                                        <div className="text-muted-foreground text-sm italic">No logs yet...</div>
                                    ) : (
                                        <div className="space-y-1">
                                            {logs.map((log, index) => (
                                                <div
                                                    key={index}
                                                    className={`text-xs font-mono p-1 rounded ${log.type === "jserr" || log.type === "stderr"
                                                        ? "text-red-300 bg-red-900/20"
                                                        : "text-green-300 bg-green-900/20"
                                                        }`}
                                                >
                                                    <span className="text-gray-400">[{log.type}]</span> {log.message}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ResizablePanel>
                    </>
                )}
            </ResizablePanelGroup>
            {isAiLoading && (
                <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center z-20 backdrop-blur-[2px]">
                    <div className="flex items-center gap-3 bg-card px-6 py-4 rounded-lg shadow-lg border border-primary/30">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-foreground text-lg font-medium">AI is modifying your code...</span>
                    </div>
                </div>
            )}
            {aiPromptConfig.visible && (
                <div
                    className="absolute inset-0 bg-background/40 flex items-start justify-center z-20 pt-20 backdrop-blur-[1px]"
                    onClick={() => setAiPromptConfig({ visible: false, mode: null })}
                >
                    <div
                        className="bg-card rounded-lg shadow-2xl w-full max-w-2xl border border-primary/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5">
                            <label htmlFor="ai-prompt" className="block text-sm font-medium text-muted-foreground mb-2">
                                {aiPromptConfig.mode === 'modification'
                                    ? 'Describe the code modification you want:'
                                    : 'Describe the UI or logic you want to generate:'}
                            </label>
                            <div className="relative">
                                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    id="ai-prompt"
                                    autoFocus
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            if (aiPromptConfig.mode === 'modification') handleAiModification();
                                            if (aiPromptConfig.mode === 'generation') handleAiGeneration();
                                        }
                                        if (e.key === 'Escape') setAiPromptConfig({ visible: false, mode: null });
                                    }}
                                    placeholder={
                                        aiPromptConfig.mode === 'modification'
                                            ? "e.g., 'add a floating action button to increment the counter'"
                                            : "e.g., 'a login screen with email and password fields'"
                                    }
                                    className="w-full bg-background text-foreground border border-border rounded-md py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary focus:border-primary transition"
                                />
                            </div>
                            <div className="mt-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2 cursor-pointer w-fit bg-accent hover:bg-accent/80 px-3 py-1.5 rounded-md">
                                    <Paperclip className="w-4 h-4" />
                                    Attach Files (Optional)
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </label>
                                {attachedFiles.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {attachedFiles.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between bg-background/50 text-xs text-muted-foreground px-2 py-1 rounded">
                                                <span>{file.name}</span>
                                                <button
                                                    onClick={() => setAttachedFiles(files => files.filter((_, i) => i !== index))}
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {aiInteractionResult && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card text-foreground rounded-lg shadow-lg flex items-center gap-4 px-4 py-2 z-10 border border-border animate-fade-in-up">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="text-sm">Code has been updated by AI.</span>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAiInteractionResult(null)}
                            className="text-foreground hover:bg-accent px-3 py-1 h-auto"
                        >
                            <Check className="w-4 h-4 mr-1.5" />
                            Keep
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                if (aiInteractionResult) {
                                    setDartCode(aiInteractionResult.originalCode);
                                }
                                setAiInteractionResult(null);
                            }}
                            className="text-foreground hover:bg-accent px-3 py-1 h-auto"
                        >
                            <Undo className="w-4 h-4 mr-1.5" />
                            Revert
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}