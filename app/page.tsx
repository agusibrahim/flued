"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { GitBranch, AlignLeft, Play, ChevronUp, ChevronDown, Download } from 'lucide-react'
import { useMobile } from "@/hooks/use-mobile"
import type { editor } from "monaco-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { appSamples } from "@/lib/samples"
import { IdeHeader } from "@/components/ide/IdeHeader"
import { EditorPanel } from "@/components/ide/EditorPanel"
import { PreviewPanel } from "@/components/ide/PreviewPanel"
import { detectFlutterWidget, findWidgetBoundaries, generateWrapCode } from "@/lib/editor"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { decorateJavaScript, fileToBase64 } from "@/lib/utils"

// Export interfaces so they can be used in other components
export interface DartIssue {
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

export interface DartAnalysisResult {
  issues: DartIssue[]
  imports: string[]
}

export interface DartFormatResult {
  source: string
  offset: number
}

export interface DartCompletionSuggestion {
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

export interface DartCompletionResult {
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
  const [dartCode, setDartCode] = useState(() => {
    if (typeof window === 'undefined') return defaultDartCode;
    return localStorage.getItem('dartpad_code') || defaultDartCode;
  });
  const [lastCompiledCode, setLastCompiledCode] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPromptConfig, setAiPromptConfig] = useState<{
    visible: boolean;
    mode: 'modification' | 'generation' | null;
  }>({ visible: false, mode: null });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [aiInteractionResult, setAiInteractionResult] = useState<{ originalCode: string; newCode: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor")
  const [analysisResult, setAnalysisResult] = useState<DartAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)
  const [wordWrap, setWordWrap] = useState<"on" | "off">("off")
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<any>(null)
  const isMobile = useMobile()

  const [isCompiling, setIsCompiling] = useState(false)
  const [deltaDill, setDeltaDill] = useState("")
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [channel, setChannel] = useState(() => {
    if (typeof window === 'undefined') return 'stable';
    return localStorage.getItem('dartpad_channel') || 'stable';
  });
  interface ErrorDialogState {
    isOpen: boolean;
    title: string;
    message: string;
    onRetry: (() => void) | null;
  }
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onRetry: null,
  });
  const [versionInfo, setVersionInfo] = useState({ dartVersion: '', flutterVersion: '' });

  const handleSampleSelect = (sampleTitle: string) => {
    const sample = appSamples.find((s) => s.title === sampleTitle);
    if (sample) {
      setDartCode(sample.code);
    }
  };

  const apiHost = useMemo(() => {
    if (channel === 'local') {
      return 'http://localhost:8080';
    }
    const subDomain = channel === 'main' ? 'master' : channel;
    return `https://${subDomain}.api.dartpad.dev`;
  }, [channel]);

  const [logs, setLogs] = useState<{ type: string; message: string }[]>([])
  const [isLogsExpanded, setIsLogsExpanded] = useState(false)
  const [logsHeight, setLogsHeight] = useState(0)
  const defaultLogsHeight = 200

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dartpad_code', dartCode);
    }
  }, [dartCode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dartpad_channel', channel);
    }
  }, [channel]);

  const updateEditorMarkers = useCallback((issues: DartIssue[]) => {
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
  }, []);

  const analyzeDartCode = useCallback(async (code: string) => {
    if (!code.trim()) return

    setIsAnalyzing(true)
    try {
      const response = await fetch(`${apiHost}/api/v3/analyze`, {
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
  }, [apiHost, updateEditorMarkers]);

  const handleSaveToFile = () => {
    if (!editorRef.current) return;
    const code = editorRef.current.getValue();
    const blob = new Blob([code], { type: 'text/dart;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const randomName = `dartpad_${Math.random().toString(36).substring(2, 10)}.dart`;

    link.setAttribute('href', url);
    link.setAttribute('download', randomName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const debouncedAnalyze = useDebounce(analyzeDartCode, 1000)

  const fetchVersionInfo = useCallback(async () => {
    try {
      const apiUrl = `${apiHost}/api/v3/version`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch version');
      const data = await response.json();
      setVersionInfo({
        dartVersion: data.dartVersion || 'N/A',
        flutterVersion: data.flutterVersion || 'N/A'
      });
    } catch (error) {
      console.error("Failed to fetch version info:", error);
      setVersionInfo({ dartVersion: 'Error', flutterVersion: 'Error' });
    }
  }, [apiHost]);

  useEffect(() => {
    fetchVersionInfo();
  }, [fetchVersionInfo]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setDartCode(value)
      debouncedAnalyze(value)
    }
  }

  async function resetIframe(): Promise<void> {
    const iframe = iframeRef.current;
    if (iframe && iframe.parentElement) {
      const clone = iframe.cloneNode(false) as HTMLIFrameElement;
      clone.src = "/frame.html";
      iframe.parentElement.appendChild(clone);
      iframe.parentElement.removeChild(iframe);
      iframeRef.current = clone;
      await Promise.race([
        new Promise<void>((resolve) => {
          clone.addEventListener('load', () => resolve(), { once: true });
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      ]);
    }
  }

  const getDartCompletions = useCallback(async (source: string, offset: number): Promise<DartCompletionResult> => {
    try {
      const response = await fetch(`${apiHost}/api/v3/complete`, {
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
      if (!result || typeof result !== "object") {
        throw new Error("Invalid completion response format")
      }
      if (!result.suggestions) {
        result.suggestions = []
      }
      return result as DartCompletionResult
    } catch (error) {
      console.error("getDartCompletions error:", error)
      return {
        replacementOffset: offset,
        replacementLength: 0,
        suggestions: [],
      }
    }
  }, [apiHost]);

  const getDartCompletionsRef = useRef(getDartCompletions);
  useEffect(() => {
    getDartCompletionsRef.current = getDartCompletions;
  }, [getDartCompletions]);

  const formatDartCode = async () => {
    if (!editorRef.current || !dartCode.trim()) return;
    const currentCode = editorRef.current.getValue();

    setIsFormatting(true);
    try {
      const position = editorRef.current.getPosition();
      const model = editorRef.current.getModel();
      if (!model || !position) return;
      const offset = model.getOffsetAt(position);

      const response = await fetch(`${apiHost}/api/v3/format`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: JSON.stringify({
          source: currentCode,
          offset: offset,
        }),
      });

      if (response.ok) {
        const result: DartFormatResult = await response.json();
        setDartCode(result.source);
        setTimeout(() => {
          if (editorRef.current && model) {
            const newPosition = model.getPositionAt(result.offset);
            editorRef.current.setPosition(newPosition);
            editorRef.current.focus();
          }
        }, 100);
        analyzeDartCode(result.source);
      }
    } catch (error) {
      console.error("Formatting failed:", error);
    } finally {
      setIsFormatting(false);
    }
  };

  const formatDartCodeRef = useRef(formatDartCode);
  useEffect(() => {
    formatDartCodeRef.current = formatDartCode;
  });

  const toggleWordWrap = () => {
    const newWrap = wordWrap === "on" ? "off" : "on"
    setWordWrap(newWrap)
    if (editorRef.current) {
      editorRef.current.updateOptions({ wordWrap: newWrap })
    }
  }
  const toggleWordWrapRef = useRef(toggleWordWrap);
  useEffect(() => {
    toggleWordWrapRef.current = toggleWordWrap;
  });

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco

    try {
      editor.addAction({
        id: 'format-document-action',
        label: 'Format Document',
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        ],
        contextMenuGroupId: '1_modification',
        contextMenuOrder: 1.5,
        run: () => formatDartCodeRef.current(),
      });
      editor.addAction({
        id: 'toggle-word-wrap-action',
        label: 'Toggle Word Wrap',
        contextMenuGroupId: 'view',
        contextMenuOrder: 1,
        run: () => toggleWordWrapRef.current(),
      });
      editor.addAction({
        id: 'ai-modification-action',
        label: 'AI Modification...',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI,
        ],
        contextMenuGroupId: '1_modification',
        contextMenuOrder: 1.7,
        run: () => {
          setAiInteractionResult(null);
          setAiPromptConfig({ visible: true, mode: 'modification' });
        },
      });
      monaco.editor.registerCommand('my-ide.smart-wrap', (ctx: any, args: { range: any; wrapperType: string }) => {
        if (!editorRef.current) return;
        const model = editorRef.current.getModel();
        if (!model) return;
        const originalCode = model.getValueInRange(args.range);
        const newText = generateWrapCode(originalCode, args.wrapperType);
        editorRef.current.executeEdits('smart-wrap', [{
          range: args.range,
          text: newText,
          forceMoveMarkers: true,
        }]);
        setTimeout(() => {
          if (args.wrapperType === 'Widget') {
            const selectionLine = args.range.startLineNumber + 1;
            const lineContent = model.getLineContent(selectionLine);
            const startCol = lineContent.indexOf('YourWidget') + 1;
            if (startCol > 0) {
              const endCol = startCol + 'YourWidget'.length;
              editorRef.current?.setSelection({
                startLineNumber: selectionLine,
                startColumn: startCol,
                endLineNumber: selectionLine,
                endColumn: endCol,
              });
              editorRef.current?.revealPositionInCenter({ lineNumber: selectionLine, column: startCol });
            }
          } else {
            formatDartCode();
          }
        }, 50);
      });
    } catch (error) {
      console.warn("Could not register smart-wrap command:", error);
    }

    try {
      monaco.languages.registerCodeActionProvider("dart", {
        provideCodeActions: (model: any, range: any, context: any) => {
          try {
            const position = { lineNumber: range.startLineNumber, column: range.startColumn };
            const widget = detectFlutterWidget(model, position);
            if (!widget) return { actions: [], dispose: () => { } };
            const boundaries = findWidgetBoundaries(model, position);
            if (!boundaries) return { actions: [], dispose: () => { } };
            const widgetRange = {
              startLineNumber: boundaries.start.lineNumber,
              endLineNumber: boundaries.end.lineNumber,
              startColumn: boundaries.start.column,
              endColumn: boundaries.end.column,
            };
            const wrapOptions = [
              { title: 'Wrap with Center', type: 'Center' },
              { title: 'Wrap with Padding', type: 'Padding' },
              { title: 'Wrap with Container', type: 'Container' },
              { title: 'Wrap with Expanded', type: 'Expanded' },
              { title: 'Wrap with Flexible', type: 'Flexible' },
              { title: 'Wrap with SizedBox', type: 'SizedBox' },
              { title: 'Wrap with Card', type: 'Card' },
              { title: 'Wrap with Column', type: 'Column' },
              { title: 'Wrap with Row', type: 'Row' },
              { title: 'Wrap with Stack', type: 'Stack' },
              { title: 'Wrap with Builder', type: 'Builder' },
              { title: 'Wrap with Widget...', type: 'Widget' },
            ];
            const actions = wrapOptions.map(option => ({
              title: option.title,
              kind: 'quickfix',
              command: {
                id: 'my-ide.smart-wrap',
                title: option.title,
                arguments: [{
                  range: widgetRange,
                  wrapperType: option.type
                }]
              }
            }));
            return { actions, dispose: () => { } };
          } catch (error) {
            console.error('Code action provider error:', error);
            return { actions: [], dispose: () => { } };
          }
        }
      });
    } catch (error) {
      console.warn("Could not register code action provider:", error);
    }

    try {
      monaco.languages.registerCompletionItemProvider("dart", {
        provideCompletionItems: async (model: any, position: any) => {
          const staticSnippets = [
            {
              label: 'stless',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: [
                'class ${1:MyWidget} extends StatelessWidget {',
                '  const ${1:MyWidget}({super.key});',
                '',
                '  @override',
                '  Widget build(BuildContext context) {',
                '    return const ${0:Placeholder()};',
                '  }',
                '}',
              ].join('\n'),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Stateless Widget',
              documentation: 'Creates a new StatelessWidget.',
            },
            {
              label: 'stfull',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: [
                'class ${1:MyWidget} extends StatefulWidget {',
                '  const ${1:MyWidget}({super.key});',
                '',
                '  @override',
                '  State<${1:MyWidget}> createState() => _${1:MyWidget}State();',
                '}',
                '',
                'class _${1:MyWidget}State extends State<${1:MyWidget}> {',
                '  @override',
                '  Widget build(BuildContext context) {',
                '    return const ${0:Placeholder()};',
                '  }',
                '}',
              ].join('\n'),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Stateful Widget',
              documentation: 'Creates a new StatefulWidget.',
            }
          ];

          try {
            const offset = model.getOffsetAt(position);
            const source = model.getValue();
            const completions = await getDartCompletionsRef.current(source, offset);
            if (!completions || !completions.suggestions || !Array.isArray(completions.suggestions)) {
              console.warn("Invalid completion response:", completions);
              return { suggestions: [] };
            }
            const dynamicSuggestions = completions.suggestions.map((suggestion: DartCompletionSuggestion) => ({
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
            }));
            return { suggestions: [...staticSnippets, ...dynamicSuggestions] };
          } catch (error) {
            console.error("Completion failed:", error);
            return { suggestions: staticSnippets };
          }
        },
        triggerCharacters: [".", " ", "\n"],
      });
    } catch (error) {
      console.warn("Could not register completion provider:", error);
    }

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

  const compileDartCode = async (isReload: boolean) => {
    if (!dartCode.trim()) return

    setIsCompiling(true)
    try {
      const response = await fetch(`${apiHost}/api/v3/${isReload ? 'compileNewDDCReload' : 'compileNewDDC'}`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: JSON.stringify({
          source: dartCode,
          deltaDill: isReload ? deltaDill : null,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.result) {
          setDeltaDill(result.deltaDill || "")
          setLastCompiledCode(dartCode);
          setTimeout(async () => {
            var jsb = decorateJavaScript(result.result, {
              modulesBaseUrl: result.modulesBaseUrl,
              isNewDDC: true,
              reload: isReload,
              isFlutter: true,
            });
            if (!isReload) await resetIframe();
            if (iframeRef.current && iframeRef.current.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                {
                  command: isReload ? "executeReload" : "execute",
                  js: jsb,
                },
                "*",
              )
              console.log("Sent compiled JS to iframe")
            }
          }, 500)
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

  const handleAiModification = async () => {
    if (!aiPrompt.trim() || !editorRef.current) return;

    setAiPromptConfig({ visible: false, mode: null });
    setIsAiLoading(true);

    const originalCode = editorRef.current.getValue();
    const attachments = await Promise.all(
      attachedFiles.map(async (file) => ({
        name: file.name,
        base64EncodedBytes: await fileToBase64(file),
        mimeType: file.type,
      }))
    );

    try {
      const response = await fetch("https://stable.api.dartpad.dev/api/v3/updateCode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          appType: "flutter",
          source: originalCode,
          prompt: aiPrompt,
          attachments: attachments,
        }),
      });

      const responseText = await response.text();

      if (response.ok && responseText.trim() !== "") {
        setDartCode(responseText);
        setAiInteractionResult({ originalCode, newCode: responseText });
        analyzeDartCode(responseText);
        setAiPrompt("");
        setAttachedFiles([]);
      } else {
        const errorDetails = response.ok ? "AI returned empty code." : `Server responded with ${response.status}: ${responseText}`;
        throw new Error(`AI Modification failed. ${errorDetails}`);
      }
    } catch (error) {
      console.error("AI Modification request error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during the request.";
      setErrorDialog({
        isOpen: true,
        title: 'AI Modification Failed',
        message: `An error occurred during AI code modification:\n\n${errorMessage}`,
        onRetry: () => setAiPromptConfig({ visible: true, mode: 'modification' }),
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiGeneration = async () => {
    if (!aiPrompt.trim()) return;

    setAiPromptConfig({ visible: false, mode: null });
    setIsAiLoading(true);
    setAiInteractionResult(null);

    const originalCode = editorRef.current?.getValue() || dartCode;

    try {
      const attachments = await Promise.all(
        attachedFiles.map(async (file) => ({
          name: file.name,
          base64EncodedBytes: await fileToBase64(file),
          mimeType: file.type,
        }))
      );

      const response = await fetch("https://stable.api.dartpad.dev/api/v3/generateCode", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          appType: "flutter",
          prompt: aiPrompt,
          attachments: attachments,
        }),
      });

      const responseText = await response.text();

      if (response.ok && responseText.trim() !== "") {
        setDartCode(responseText);
        setAiInteractionResult({ originalCode, newCode: responseText });
        analyzeDartCode(responseText);
        setAiPrompt("");
        setAttachedFiles([]);
      } else {
        const errorDetails = response.ok ? "AI returned empty code." : `Server responded with ${response.status}: ${responseText}`;
        throw new Error(`AI Generation failed. ${errorDetails}`);
      }
    } catch (error) {
      console.error("AI Generation request error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during the request.";
      setErrorDialog({
        isOpen: true,
        title: 'AI Generation Failed',
        message: `An error occurred during AI code generation:\n\n${errorMessage}`,
        onRetry: () => setAiPromptConfig({ visible: true, mode: 'generation' }),
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachedFiles(Array.from(e.target.files));
    }
  };

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object" || event.data.sender !== "frame") return

      if (event.data.type === "stdout") {
        setLogs((prev) => [...prev, { type: "stdout", message: event.data.message }])
        console.log("[Flutter stdout]", event.data.message)
      } else if (event.data.type === "jserr" || event.data.type === "stderr") {
        setLogs((prev) => [...prev, { type: "jserr", message: event.data.message }])
        console.error("[Flutter jserr]", event.data.message)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <AlertDialog open={errorDialog.isOpen} onOpenChange={(open) => !open && setErrorDialog({ ...errorDialog, isOpen: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                {errorDialog.message}
              </pre>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (errorDialog.onRetry) {
                errorDialog.onRetry();
              }
            }}>
              Try Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isMobile && (
        <div className="bg-card border-b border-border flex">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex-1 px-3 py-2 text-xs font-normal text-center transition-colors relative ${activeTab === "editor" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Editor
            {activeTab === "editor" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex-1 px-3 py-2 text-xs font-normal text-center transition-colors relative ${activeTab === "preview" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Preview
            {activeTab === "preview" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {!isMobile ? (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
              <div className="h-full flex flex-col">
                <IdeHeader
                  isAnalyzing={isAnalyzing}
                  analysisResult={analysisResult}
                  onSampleSelect={handleSampleSelect}
                  onGenerateClick={() => {
                    setAiInteractionResult(null);
                    setAiPromptConfig({ visible: true, mode: 'generation' });
                  }}
                  onRunClick={() => compileDartCode(false)}
                  onHotReloadClick={() => compileDartCode(true)}
                  isCompiling={isCompiling}
                  hasHotReload={deltaDill.length > 20}
                  lastCompiledCode={lastCompiledCode}
                  dartCode={dartCode}
                />
                <EditorPanel
                  dartCode={dartCode}
                  handleEditorChange={handleEditorChange}
                  handleEditorDidMount={handleEditorDidMount}
                  wordWrap={wordWrap}
                  isLogsExpanded={isLogsExpanded}
                  logs={logs}
                  setLogs={setLogs}
                  setIsLogsExpanded={setIsLogsExpanded}
                  setLogsHeight={setLogsHeight}
                  isAiLoading={isAiLoading}
                  aiPromptConfig={aiPromptConfig}
                  setAiPromptConfig={setAiPromptConfig}
                  aiPrompt={aiPrompt}
                  setAiPrompt={setAiPrompt}
                  handleAiModification={handleAiModification}
                  handleAiGeneration={handleAiGeneration}
                  handleFileSelect={handleFileSelect}
                  attachedFiles={attachedFiles}
                  setAttachedFiles={setAttachedFiles}
                  aiInteractionResult={aiInteractionResult}
                  setAiInteractionResult={setAiInteractionResult}
                  setDartCode={setDartCode}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle className="bg-border hover:bg-accent active:bg-primary transition-colors" />
            <ResizablePanel defaultSize={32} minSize={20} maxSize={35}>
              <PreviewPanel iframeRef={iframeRef} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full flex flex-col">
            {activeTab === "editor" && (
              <div className="flex-1 flex flex-col bg-background">
                <div className="bg-card border-b border-border px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h1 className="text-foreground font-semibold text-sm">DartIDE</h1>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={formatDartCode} disabled={isFormatting} className="text-muted-foreground hover:text-foreground hover:bg-accent px-2">
                      {isFormatting ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <AlignLeft className="w-3 h-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => compileDartCode(false)} disabled={isCompiling} className="text-muted-foreground hover:text-foreground hover:bg-accent px-2">
                      {isCompiling ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <Play className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex-1">
                  <EditorPanel
                    dartCode={dartCode}
                    handleEditorChange={handleEditorChange}
                    handleEditorDidMount={handleEditorDidMount}
                    wordWrap={wordWrap}
                    isLogsExpanded={isLogsExpanded}
                    logs={logs}
                    setLogs={setLogs}
                    setIsLogsExpanded={setIsLogsExpanded}
                    setLogsHeight={setLogsHeight}
                    isAiLoading={isAiLoading}
                    aiPromptConfig={aiPromptConfig}
                    setAiPromptConfig={setAiPromptConfig}
                    aiPrompt={aiPrompt}
                    setAiPrompt={setAiPrompt}
                    handleAiModification={handleAiModification}
                    handleAiGeneration={handleAiGeneration}
                    handleFileSelect={handleFileSelect}
                    attachedFiles={attachedFiles}
                    setAttachedFiles={setAttachedFiles}
                    aiInteractionResult={aiInteractionResult}
                    setAiInteractionResult={setAiInteractionResult}
                    setDartCode={setDartCode}
                  />
                </div>
              </div>
            )}
            {activeTab === "preview" && (
              <div className="flex-1 bg-background overflow-auto">
                <PreviewPanel iframeRef={iframeRef} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-card border-t border-border px-4 py-1 flex items-center justify-between text-xs text-muted-foreground h-8 shrink-0">
        <div className="flex items-center gap-2">
          <Select value={channel} onValueChange={(newChannel) => setChannel(newChannel)}>
            <SelectTrigger className="w-[180px] h-6 text-xs bg-card border-border hover:bg-accent focus:ring-primary">
              <GitBranch className="w-3 h-3 mr-2" />
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stable">Stable Channel</SelectItem>
              <SelectItem value="beta">Beta Channel</SelectItem>
              <SelectItem value="main">Main Channel</SelectItem>
              <SelectItem value="local">Localhost Channel</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsLogsExpanded(!isLogsExpanded)
              setLogsHeight(isLogsExpanded ? 0 : defaultLogsHeight)
            }}
            className="text-muted-foreground hover:text-foreground hover:bg-accent h-6 w-6"
            title="Toggle Logs"
          >
            {isLogsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
          {deltaDill.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSaveToFile}
              className="text-muted-foreground hover:text-foreground hover:bg-accent h-6 w-6"
              title="Save to File"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Dart: {versionInfo.dartVersion}</span>
          <Separator orientation="vertical" className="h-4 bg-border" />
          <span>Flutter: {versionInfo.flutterVersion}</span>
        </div>
      </div>
    </div>
  )
}