"use client"

import { useState, useRef, useCallback } from "react"
import Editor from "@monaco-editor/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Code, RotateCcw, Monitor, AlertCircle, CheckCircle, AlignLeft, WrapText, Play } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import type { editor } from "monaco-editor"

interface DartIssue {
  kind: "error" | "warning" | "info"
  message: string
  location: {
    charStart: number
    charLength: number
    line: number
    column: number
  }
  code: string
  correction?: string
  url?: string
}

interface DartAnalysisResult {
  issues: DartIssue[]
  imports: string[]
}

interface DartFormatResult {
  source: string
  offset: number
}

interface DartCompletionSuggestion {
  kind: string
  relevance: number
  completion: string
  deprecated: boolean
  selectionOffset: number
  displayText?: string
  parameterNames?: string[]
  returnType?: string
  elementKind?: string
  elementParameters?: string
}

interface DartCompletionResult {
  replacementOffset: number
  replacementLength: number
  suggestions: DartCompletionSuggestion[]
}

const defaultDartCode = `import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: Colors.blue),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  final String title;

  const MyHomePage({super.key, required this.title});

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('You have pushed the button this many times:'),
            Text(
              '$_counter',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: const Icon(Icons.add),
      ),
    );
  }
}`

// Detect if user is on Mac (for UI display only)
const isMac =
  typeof window !== "undefined" &&
  (navigator.platform.toUpperCase().indexOf("MAC") >= 0 || navigator.userAgent.toUpperCase().indexOf("MAC") >= 0)

// Debounce utility function
function useDebounce<T extends (...args: any[]) => void>(callback: T, delay: number): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay)
    }) as T,
    [callback, delay],
  )
}

export default function DeveloperIDE() {
  const [dartCode, setDartCode] = useState(defaultDartCode)
  const [previewKey, setPreviewKey] = useState(0)
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor")
  const [previewWidth, setPreviewWidth] = useState(0)
  const [analysisResult, setAnalysisResult] = useState<DartAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on")
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<any>(null)
  const isMobile = useMobile()

  const [isCompiling, setIsCompiling] = useState(false)
  const [compiledJs, setCompiledJs] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // DartPad API host (change here to switch environments)
  const DARTPAD_API_HOST = "http://localhost:8080" // Use your local DartPad API host

  // Debounced analyzer function
  const debouncedAnalyze = useDebounce(
    useCallback((code: string) => {
      analyzeDartCode(code)
    }, []),
    1000,
  )

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setDartCode(value)
      // Use debounced analyzer
      debouncedAnalyze(value)
    }
  }

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Add custom keyboard shortcuts for formatting only
    try {
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => formatDartCode())
    } catch (error) {
      console.warn("Could not set format shortcut:", error)
    }

    // Register Dart completion provider
    try {
      monaco.languages.registerCompletionItemProvider("dart", {
        provideCompletionItems: async (model: any, position: any) => {
          try {
            const offset = model.getOffsetAt(position)
            const source = model.getValue()

            // Call completion API directly (no debounce needed, Monaco handles this)
            const completions = await getDartCompletions(source, offset)

            // Check if completions is valid
            if (!completions || !completions.suggestions || !Array.isArray(completions.suggestions)) {
              console.warn("Invalid completion response:", completions)
              return { suggestions: [] }
            }

            return {
              suggestions: completions.suggestions.map((suggestion: DartCompletionSuggestion) => ({
                label: suggestion.completion,
                kind: getMonacoCompletionKind(monaco, suggestion.kind, suggestion.elementKind),
                insertText: suggestion.completion,
                detail: suggestion.returnType || suggestion.elementKind,
                documentation: suggestion.elementParameters || suggestion.displayText,
                sortText: String(1000 - suggestion.relevance).padStart(4, "0"),
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: position.column - (completions.replacementLength || 0),
                  endColumn: position.column,
                },
              })),
            }
          } catch (error) {
            console.error("Completion failed:", error)
            return { suggestions: [] }
          }
        },
        // Add Enter key and other triggers for autocomplete
        triggerCharacters: [".", " ", "\n"],
      })
    } catch (error) {
      console.warn("Could not register completion provider:", error)
    }

    // Initial analysis
    analyzeDartCode(dartCode)
  }

  const getMonacoCompletionKind = (monaco: any, kind: string, elementKind?: string) => {
    try {
      switch (kind) {
        case "INVOCATION":
          return elementKind === "METHOD"
            ? monaco.languages.CompletionItemKind.Method
            : monaco.languages.CompletionItemKind.Function
        case "IDENTIFIER":
          switch (elementKind) {
            case "GETTER":
            case "SETTER":
              return monaco.languages.CompletionItemKind.Property
            case "FIELD":
              return monaco.languages.CompletionItemKind.Field
            case "CLASS":
              return monaco.languages.CompletionItemKind.Class
            case "ENUM":
              return monaco.languages.CompletionItemKind.Enum
            case "VARIABLE":
              return monaco.languages.CompletionItemKind.Variable
            default:
              return monaco.languages.CompletionItemKind.Text
          }
        case "KEYWORD":
          return monaco.languages.CompletionItemKind.Keyword
        default:
          return monaco.languages.CompletionItemKind.Text
      }
    } catch (error) {
      return monaco.languages.CompletionItemKind.Text
    }
  }

  // Direct completion function without debounce (Monaco handles debouncing)
  const getDartCompletions = async (source: string, offset: number): Promise<DartCompletionResult> => {
    try {
      const response = await fetch(`${DARTPAD_API_HOST}/api/v3/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: JSON.stringify({
          source: source,
          offset: offset,
        }),
      })

      if (!response.ok) {
        throw new Error(`Completion request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      // Validate the response structure
      if (!result || typeof result !== "object") {
        throw new Error("Invalid completion response format")
      }

      // Ensure suggestions array exists
      if (!result.suggestions) {
        result.suggestions = []
      }

      return result as DartCompletionResult
    } catch (error) {
      console.error("getDartCompletions error:", error)
      // Return empty result on error
      return {
        replacementOffset: offset,
        replacementLength: 0,
        suggestions: [],
      }
    }
  }

  const compileDartCode = async () => {
    if (!dartCode.trim()) return

    setIsCompiling(true)
    try {
      const response = await fetch(`${DARTPAD_API_HOST}/api/v3/compileNewDDC`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: JSON.stringify({
          source: dartCode,
          deltaDill: null,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.result) {
          setCompiledJs(result.result)
          setIsRunning(true)
          // Send compiled JS to iframe after a short delay to ensure iframe is ready
          setTimeout(() => {
            var jsb = `
            function dartPrint(message) {
  parent.postMessage({
    'sender': 'frame',
    'type': 'stdout',
    'message': message.toString(),
  }, '*');
}

window.onerror = function(message, url, line, column, error) {
  var errorMessage = error == null ? '' : ', error: ' + error;
  parent.postMessage({
    'sender': 'frame',
    'type': 'jserr',
    'message': message + errorMessage
  }, '*');
};

require.config({
  "baseUrl": "https://storage.googleapis.com/nnbd_artifacts/3.8.1/",
  "waitSeconds": 60,
  "onNodeCreated": function(node, config, id, url) { node.setAttribute('crossorigin', 'anonymous'); }
});

let __ddcInitCode = function() {${result.result}}
function contextLoaded() {
  __ddcInitCode();
  dartDevEmbedder.runMain('package:dartpad_sample/bootstrap.dart', {});
}
function moduleLoaderLoaded() {
  require(["dart_sdk_new", "flutter_web_new"], contextLoaded);
}
require(["ddc_module_loader"], moduleLoaderLoaded);
            `;
            if (iframeRef.current && iframeRef.current.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                {
                  command: "execute",
                  js: jsb,
                },
                "*",
              )
              console.log("Sent compiled JS to iframe")
              console.log(iframeRef.current.contentWindow)
              iframeRef.current.contentWindow.localStorage.setItem("dartpad_sample", "kokosss")
              iframeRef.current.contentWindow.document.body.style.backgroundColor = "#ff0000" // Set dark background
            }
          }, 2500)
        }
      } else {
        console.error("Compilation failed:", response.status, response.statusText)
      }
    } catch (error) {
      console.error("Compilation error:", error)
    } finally {
      setIsCompiling(false)
    }
  }

  const analyzeDartCode = async (code: string) => {
    if (!code.trim()) return

    setIsAnalyzing(true)
    try {
      const response = await fetch(`${DARTPAD_API_HOST}/api/v3/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: JSON.stringify({
          source: code,
          offset: null,
        }),
      })

      if (response.ok) {
        const result: DartAnalysisResult = await response.json()
        setAnalysisResult(result)
        updateEditorMarkers(result.issues)
      }
    } catch (error) {
      console.error("Analysis failed:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const formatDartCode = async () => {
    if (!editorRef.current || !dartCode.trim()) return

    setIsFormatting(true)
    try {
      // Get current cursor position
      const position = editorRef.current.getPosition()
      const model = editorRef.current.getModel()
      if (!model || !position) return

      // Convert position to offset
      const offset = model.getOffsetAt(position)

      const response = await fetch(`${DARTPAD_API_HOST}/api/v3/format`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: JSON.stringify({
          source: dartCode,
          offset: offset,
        }),
      })

      if (response.ok) {
        const result: DartFormatResult = await response.json()

        // Update the code
        setDartCode(result.source)

        // Restore cursor position after a short delay to allow editor to update
        setTimeout(() => {
          if (editorRef.current && model) {
            const newPosition = model.getPositionAt(result.offset)
            editorRef.current.setPosition(newPosition)
            editorRef.current.focus()
          }
        }, 100)

        // Re-analyze the formatted code
        analyzeDartCode(result.source)
      }
    } catch (error) {
      console.error("Formatting failed:", error)
    } finally {
      setIsFormatting(false)
    }
  }

  const toggleWordWrap = () => {
    const newWrap = wordWrap === "on" ? "off" : "on"
    setWordWrap(newWrap)

    // Update editor word wrap setting
    if (editorRef.current) {
      editorRef.current.updateOptions({ wordWrap: newWrap })
    }
  }

  const updateEditorMarkers = (issues: DartIssue[]) => {
    if (!editorRef.current || !monacoRef.current) return

    const monaco = monacoRef.current
    const model = editorRef.current.getModel()
    if (!model) return

    try {
      const markers = issues.map((issue) => ({
        startLineNumber: issue.location.line,
        startColumn: issue.location.column,
        endLineNumber: issue.location.line,
        endColumn: issue.location.column + issue.location.charLength,
        message: issue.message + (issue.correction ? `\n${issue.correction}` : ""),
        severity:
          issue.kind === "error"
            ? monaco.MarkerSeverity.Error
            : issue.kind === "warning"
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
        code: issue.code,
      }))

      monaco.editor.setModelMarkers(model, "dart-analyzer", markers)
    } catch (error) {
      console.error("Failed to set markers:", error)
    }
  }

  const refreshPreview = () => {
    setPreviewKey((prev) => prev + 1)
  }

  const resetCode = () => {
    setDartCode(defaultDartCode)
    setPreviewKey((prev) => prev + 1)
    analyzeDartCode(defaultDartCode)
  }

  const handlePanelResize = (sizes: number[]) => {
    const approximateWidth = Math.round((sizes[1] / 100) * 1200)
    setPreviewWidth(approximateWidth)
  }

  const errorCount = analysisResult?.issues.filter((issue) => issue.kind === "error").length || 0
  const warningCount = analysisResult?.issues.filter((issue) => issue.kind === "warning").length || 0

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            <h1 className="text-white font-semibold text-base md:text-lg">DartIDE</h1>
          </div>
          <Separator orientation="vertical" className="h-4 md:h-6 bg-gray-600 hidden sm:block" />
          <span className="text-gray-400 text-xs md:text-sm hidden sm:block">
            Dart Editor & Preview
          </span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {/* Analysis Status */}
          <div className="flex items-center gap-1 mr-2">
            {isAnalyzing ? (
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            ) : analysisResult ? (
              <>
                {errorCount > 0 && (
                  <div className="flex items-center gap-1 text-red-400">
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
            onClick={toggleWordWrap}
            className={`text-gray-300 hover:text-white hover:bg-gray-700 px-2 md:px-3 ${wordWrap === "on" ? "bg-gray-700 text-white" : ""
              }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-3 h-3 md:w-4 md:h-4" />
            <span className="hidden lg:inline ml-1">Wrap</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={formatDartCode}
            disabled={isFormatting}
            className="text-gray-300 hover:text-white hover:bg-gray-700 px-2 md:px-3"
            title={`Format Code (⇧⌥F)`}
          >
            {isFormatting ? (
              <div className="w-3 h-3 md:w-4 md:h-4 border border-current border-t-transparent rounded-full animate-spin md:mr-1" />
            ) : (
              <AlignLeft className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
            )}
            <span className="hidden md:inline">Format</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={compileDartCode}
            disabled={isCompiling}
            className="text-gray-300 hover:text-white hover:bg-gray-700 px-2 md:px-3"
            title="Run Code"
          >
            {isCompiling ? (
              <div className="w-3 h-3 md:w-4 md:h-4 border border-current border-t-transparent rounded-full animate-spin md:mr-1" />
            ) : (
              <Play className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
            )}
            <span className="hidden md:inline">Run</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCode}
            className="text-gray-300 hover:text-white hover:bg-gray-700 px-2 md:px-3"
          >
            <RotateCcw className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
            <span className="hidden md:inline">Reset</span>
          </Button>
        </div>
      </div>

      {/* Mobile Tabs */}
      {isMobile && (
        <div className="bg-gray-800 border-b border-gray-700 flex">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex-1 px-3 py-2 text-xs font-normal text-center transition-colors relative ${activeTab === "editor" ? "text-white" : "text-gray-400 hover:text-gray-300"
              }`}
          >
            Editor
            {activeTab === "editor" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex-1 px-3 py-2 text-xs font-normal text-center transition-colors relative ${activeTab === "preview" ? "text-white" : "text-gray-400 hover:text-gray-300"
              }`}
          >
            Preview
            {activeTab === "preview" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1">
        {/* Desktop Layout */}
        {!isMobile && (
          <ResizablePanelGroup direction="horizontal" className="h-full" onLayout={handlePanelResize}>
            {/* Editor Panel */}
            <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
              <div className="h-full flex flex-col bg-gray-900">
                <div className="flex-1 overflow-y-auto">
                  <Editor
                    height="100%"
                    defaultLanguage="dart"
                    value={dartCode}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      fontFamily: "JetBrains Mono, Fira Code, Monaco, monospace",
                      lineNumbers: "on",
                      roundedSelection: false,
                      scrollBeyondLastLine: false,
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
                      // Enable error squiggles and hover
                      renderValidationDecorations: "on",
                      showUnused: true,
                      // Better accessibility support
                      accessibilitySupport: "auto",
                      contextmenu: true,
                      // Enable autocomplete
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
                    }}
                  />
                </div>
              </div>
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle className="bg-gray-700 hover:bg-gray-600 active:bg-blue-500 transition-colors" />

            {/* Preview Panel */}
            <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
              <div className="h-full bg-gray-800 flex flex-col">
                <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300 text-sm font-medium">
                      {isRunning ? "Flutter App" : "Code Preview"}
                    </span>
                    {isRunning && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsRunning(false)}
                        className="text-gray-400 hover:text-white hover:bg-gray-700 px-2 py-1 text-xs"
                      >
                        Back to Code
                      </Button>
                    )}
                  </div>
                  {previewWidth > 0 && !isRunning && <div className="text-xs text-gray-500">~{previewWidth}px</div>}
                </div>
                <div className="flex-1 overflow-auto">
                  {true ? (
                    <iframe
                      ref={iframeRef}
                      src="/frame.html"
                      className="w-full h-full border-0"
                      title="Flutter App Preview"
                      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin"
                      allow="clipboard-write"
                      style={{ border: "none", width: "100%", height: "100%" }}
                    />
                  ) : (
                    <pre
                      key={previewKey}
                      className="p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap bg-gray-900 h-full"
                    >
                      {dartCode}
                    </pre>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {/* Mobile Layout */}
        {isMobile && (
          <div className="h-full flex flex-col">
            {/* Editor Tab */}
            {activeTab === "editor" && (
              <div className="flex-1 flex flex-col bg-gray-900">
                <div className="flex-1">
                  <Editor
                    height="100%"
                    defaultLanguage="dart"
                    value={dartCode}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                      fontSize: 12,
                      fontFamily: "JetBrains Mono, Fira Code, Monaco, monospace",
                      lineNumbers: "on",
                      roundedSelection: false,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      minimap: { enabled: false },
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
                    }}
                  />
                </div>
              </div>
            )}

            {/* Preview Tab */}
            {activeTab === "preview" && (
              <div className="flex-1 bg-gray-900 overflow-auto">
                {isRunning ? (
                  <iframe
                    ref={iframeRef}
                    src="/frame.html"
                    className="w-full h-full border-0"
                    title="Flutter App Preview"
                    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin"
                    allow="clipboard-write"
                    style={{ border: "none", width: "100%", height: "100%" }}
                  />
                ) : (
                  <pre className="p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap">{dartCode}</pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
