"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import Editor from "@monaco-editor/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Code, Sparkles, Check, GitBranch, Undo, AlertCircle, CheckCircle, AlignLeft, WrapText, Play, RefreshCw, ChevronUp, ChevronDown, Trash2, Lightbulb, Download, Paperclip, X } from 'lucide-react'
import { useMobile } from "@/hooks/use-mobile"
import { ModeToggle } from "@/components/theme-toggle"
import type { editor } from "monaco-editor"
import { set } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { appSamples } from "@/lib/samples"
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
  const [dartCode, setDartCode] = useState(() => {
    if (typeof window === 'undefined') return defaultDartCode;
    return localStorage.getItem('dartpad_code') || defaultDartCode;
  });
  const [previewKey, setPreviewKey] = useState(0)
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
  const [previewWidth, setPreviewWidth] = useState(0)
  const [analysisResult, setAnalysisResult] = useState<DartAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)
  const [wordWrap, setWordWrap] = useState<"on" | "off">("off")
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<any>(null)
  const isMobile = useMobile()

  const [isCompiling, setIsCompiling] = useState(false)
  const [compiledJs, setCompiledJs] = useState<string | null>(null)
  // const [isRunning, setIsRunning] = useState(false)
  const [deltaDill, setDeltaDill] = useState("")
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [channel, setChannel] = useState(() => {
    if (typeof window === 'undefined') return 'stable';
    return localStorage.getItem('dartpad_channel') || 'stable';
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

  // Tambahkan state untuk log jika ingin menampilkan log di UI
  const [logs, setLogs] = useState<{ type: string; message: string }[]>([])
  const [isLogsExpanded, setIsLogsExpanded] = useState(false)
  const [logsHeight, setLogsHeight] = useState(0)
  const defaultLogsHeight = 200

  // Save code and channel to localStorage on change
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
  }, [apiHost, monacoRef, editorRef]); // Tambahkan dependensi yang relevan

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


  // Debounced analyzer function
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
      // Use debounced analyzer
      debouncedAnalyze(value)
    }
  }
  // Fungsi resetIframe: reset dan reload iframe sesuai kode Dart
  async function resetIframe(): Promise<void> {
    const iframe = iframeRef.current;
    if (iframe && iframe.parentElement) {
      // Buat clone dari iframe tanpa child nodes
      const clone = iframe.cloneNode(false) as HTMLIFrameElement;
      clone.src = "/frame.html"; // Set ulang src untuk memastikan iframe baru dimuat

      // Tambahkan clone ke parent, lalu hapus iframe lama
      iframe.parentElement.appendChild(clone);
      iframe.parentElement.removeChild(iframe);

      // Update ref ke clone (jika perlu)
      iframeRef.current = clone;

      // Tunggu event 'load' atau timeout 1 detik
      await Promise.race([
        new Promise<void>((resolve) => {
          clone.addEventListener('load', () => resolve(), { once: true });
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      ]);
    }
  }

  // Direct completion function without debounce (Monaco handles debouncing)
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
  }, [apiHost]);

  // Refs to hold the latest version of functions for event handlers/providers
  const getDartCompletionsRef = useRef(getDartCompletions);
  useEffect(() => {
    getDartCompletionsRef.current = getDartCompletions;
  }, [getDartCompletions]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // A. Daftarkan satu command "pintar" untuk menangani semua logika
    try {
      editor.addAction({
        id: 'format-document-action', // ID unik untuk aksi ini
        label: 'Format Document',      // Teks yang muncul di menu
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        ],
        contextMenuGroupId: '1_modification', // Mengelompokkan dengan aksi edit lain
        contextMenuOrder: 1.5,                 // Urutan di dalam grup
        run: () => {
          formatDartCodeRef.current(); // Panggil fungsi format melalui ref
        },
      });
      editor.addAction({
        id: 'toggle-word-wrap-action',
        label: 'Toggle Word Wrap',
        contextMenuGroupId: 'view', // Grup untuk aksi terkait tampilan
        contextMenuOrder: 1,
        run: () => {
          toggleWordWrapRef.current(); // Panggil fungsi toggle melalui ref
        },
      });
      editor.addAction({
        id: 'ai-modification-action',
        label: 'AI Modification...',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI,
        ],
        contextMenuGroupId: '1_modification',
        contextMenuOrder: 1.7, // Tempatkan setelah Format
        run: () => {
          setAiInteractionResult(null); // Hapus banner revert jika ada
          setAiPromptConfig({ visible: true, mode: 'modification' });
        },
      });
      monaco.editor.registerCommand('my-ide.smart-wrap', (ctx: any, args: { range: any; wrapperType: string }) => {
        if (!editorRef.current) return;

        const model = editorRef.current.getModel();
        if (!model) return;

        // 1. Dapatkan kode asli dan hasilkan kode baru
        const originalCode = model.getValueInRange(args.range);
        const newText = generateWrapCode(originalCode, args.wrapperType);

        // 2. Lakukan edit pada editor
        editorRef.current.executeEdits('smart-wrap', [{
          range: args.range,
          text: newText,
          forceMoveMarkers: true,
        }]);

        // 3. Jalankan logika kondisional setelah editan selesai
        setTimeout(() => {
          if (args.wrapperType === 'Widget') {
            // KHUSUS "Widget": pilih teks placeholder, JANGAN format
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
            // UNTUK SEMUA LAINNYA: jalankan format kode
            formatDartCode();
          }
        }, 50);
      });
    } catch (error) {
      console.warn("Could not register smart-wrap command:", error);
    }

    // B. Daftarkan Code Action Provider (Quick Fix)
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

            // Panggil command 'my-ide.smart-wrap' dari setiap opsi
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

    // Register Dart completion provider
    try {
      monaco.languages.registerCompletionItemProvider("dart", {
        provideCompletionItems: async (model: any, position: any) => {
          // --- KODE BARU DIMULAI DI SINI ---

          // 1. Definisikan snippet statis untuk stless dan stfull
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

          // --- AKHIR KODE BARU ---

          try {
            const offset = model.getOffsetAt(position);
            const source = model.getValue();

            // Panggil API untuk autocompletion dinamis
            const completions = await getDartCompletionsRef.current(source, offset);

            if (!completions || !completions.suggestions || !Array.isArray(completions.suggestions)) {
              console.warn("Invalid completion response:", completions);
              return { suggestions: [] };
            }

            const dynamicSuggestions = completions.suggestions.map((suggestion: DartCompletionSuggestion) => ({
              // ... (mapping Anda yang sudah ada)
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

            // Gabungkan snippet statis dengan saran dinamis dari API
            return { suggestions: [...staticSnippets, ...dynamicSuggestions] };

          } catch (error) {
            console.error("Completion failed:", error);
            // Jika API gagal, tetap tampilkan snippet statis
            return { suggestions: staticSnippets };
          }
        },
        triggerCharacters: [".", " ", "\n"],
      });
    } catch (error) {
      console.warn("Could not register completion provider:", error);
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

  // Helper function to detect if cursor is on a Flutter widget
  const detectFlutterWidget = (model: any, position: any): { widgetName: string; range: any } | null => {
    try {
      const lineContent = model.getLineContent(position.lineNumber)
      const wordAtPosition = model.getWordAtPosition(position)

      if (!wordAtPosition) return null

      const word = wordAtPosition.word

      // Common Flutter widgets
      const flutterWidgets = [
        'Container', 'Column', 'Row', 'Stack', 'Positioned', 'Expanded', 'Flexible',
        'Text', 'RichText', 'TextField', 'TextFormField', 'Button', 'ElevatedButton',
        'TextButton', 'OutlinedButton', 'IconButton', 'FloatingActionButton',
        'Image', 'Icon', 'CircularProgressIndicator', 'LinearProgressIndicator',
        'Card', 'ListTile', 'ListView', 'GridView', 'SingleChildScrollView',
        'Scaffold', 'AppBar', 'Drawer', 'BottomNavigationBar', 'TabBar',
        'AlertDialog', 'SimpleDialog', 'BottomSheet', 'SnackBar',
        'Padding', 'Margin', 'Center', 'Align', 'SizedBox', 'AspectRatio',
        'FractionallySizedBox', 'IntrinsicHeight', 'IntrinsicWidth',
        'Wrap', 'Flow', 'Table', 'DataTable', 'Stepper', 'ExpansionTile',
        'CheckboxListTile', 'RadioListTile', 'SwitchListTile', 'Slider',
        'RangeSlider', 'Checkbox', 'Radio', 'Switch', 'DropdownButton',
        'PopupMenuButton', 'Tooltip', 'Hero', 'AnimatedContainer',
        'AnimatedOpacity', 'AnimatedPositioned', 'AnimatedSize',
        'FadeTransition', 'SlideTransition', 'ScaleTransition', 'RotationTransition'
      ]

      if (flutterWidgets.includes(word)) {
        return {
          widgetName: word,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordAtPosition.startColumn,
            endColumn: wordAtPosition.endColumn,
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error detecting Flutter widget:', error)
      return null
    }
  }

  // Helper function to find widget boundaries (IMPROVED AND CORRECTED)
  const findWidgetBoundaries = (model: any, position: any): { start: any; end: any } | null => {
    try {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return null;

      const startPos = {
        lineNumber: position.lineNumber,
        column: wordInfo.startColumn,
      };

      let parenCount = 0;
      let foundFirstParen = false;

      // Loop through the rest of the document from the widget name
      for (let l = position.lineNumber; l <= model.getLineCount(); l++) {
        const lineContent = model.getLineContent(l);
        // Start scanning from the end of the word on the first line, or the beginning of subsequent lines
        const startCol = l === position.lineNumber ? wordInfo.endColumn - 1 : 0;

        for (let c = startCol; c < lineContent.length; c++) {
          const char = lineContent[c];

          // We only start counting after the first parenthesis is found
          if (!foundFirstParen) {
            if (char === '(') {
              foundFirstParen = true;
              parenCount++;
            }
            // If we find something other than whitespace before the first '(', it's not a constructor
            else if (char !== ' ' && char !== '\t') {
              return null;
            }
          } else {
            // Basic string check to ignore parentheses inside literals
            if (char === "'" || char === '"') {
              let endQuote = c + 1;
              while (endQuote < lineContent.length) {
                if (lineContent[endQuote] === char && lineContent[endQuote - 1] !== '\\') {
                  break;
                }
                endQuote++;
              }
              c = endQuote;
              continue;
            }

            if (char === '(') {
              parenCount++;
            } else if (char === ')') {
              parenCount--;
            }
          }

          // When we find the matching closing parenthesis
          if (foundFirstParen && parenCount === 0) {
            let endPos = { lineNumber: l, column: c + 2 }; // Position is after ')'

            // Bonus: Greedily consume a trailing comma for cleaner replacement
            for (let sl = l; sl <= model.getLineCount(); sl++) {
              const subLine = model.getLineContent(sl);
              const subStartCol = sl === l ? c + 1 : 0;
              let stop = false;

              for (let sc = subStartCol; sc < subLine.length; sc++) {
                const subChar = subLine[sc];
                if (subChar === ',') {
                  // Found a comma, update the end position to be after it
                  endPos = { lineNumber: sl, column: sc + 2 };
                  stop = true;
                  break;
                }
                // If we find another character, stop searching for a comma
                if (subChar !== ' ' && subChar !== '\t' && subChar !== '\n' && subChar !== '\r') {
                  stop = true;
                  break;
                }
              }
              if (stop) break;
            }

            return { start: startPos, end: endPos };
          }
        }
      }

      return null; // No matching parenthesis found
    } catch (error) {
      console.error('Error finding widget boundaries:', error);
      return null;
    }
  };

  // Generate wrap code for different wrapper types (FINAL, COMMA-AWARE VERSION)
  const generateWrapCode = (originalCode: string, wrapperType: string): string => {
    // 1. Cek apakah kode asli memiliki koma di akhir (setelah di-trim).
    const trimmedOriginal = originalCode.trim();
    const hadTrailingComma = trimmedOriginal.endsWith(',');

    // 2. Siapkan kode untuk dibungkus dengan MENGHILANGKAN koma tersebut.
    const codeToWrap = hadTrailingComma
      ? trimmedOriginal.slice(0, -1).trim()
      : trimmedOriginal;

    // 3. Siapkan indentasi dan koma penutup KONDISIONAL.
    const indent = '  ';
    const finalComma = hadTrailingComma ? ',' : '';

    // 4. Hasilkan kode dengan template yang menggunakan `finalComma`.
    switch (wrapperType) {
      case 'Center':
      case 'Expanded':
      case 'Flexible':
      case 'Card':
      case 'SizedBox':
        return `${wrapperType}(\n${indent}child: ${codeToWrap},\n)${finalComma}`;

      case 'Padding':
        return `Padding(\n${indent}padding: const EdgeInsets.all(8.0),\n${indent}child: ${codeToWrap},\n)${finalComma}`;

      case 'Container':
        return `Container(\n${indent}child: ${codeToWrap},\n)${finalComma}`;

      case 'Column':
        // Koma setelah `codeToWrap` di sini selalu ada karena merupakan item list.
        // `finalComma` berlaku untuk widget Column itu sendiri.
        return `Column(\n${indent}children: [\n${indent}${indent}${codeToWrap},\n${indent}],\n)${finalComma}`;

      case 'Row':
        return `Row(\n${indent}children: [\n${indent}${indent}${codeToWrap},\n${indent}],\n)${finalComma}`;

      case 'Stack':
        return `Stack(\n${indent}children: [\n${indent}${indent}${codeToWrap},\n${indent}],\n)${finalComma}`;

      case 'Builder':
        return `Builder(\n${indent}builder: (context) {\n${indent}${indent}return ${codeToWrap};\n${indent}},\n)${finalComma}`;

      case 'Widget':
        return `// TODO: Replace with your custom widget\nYourWidget(\n${indent}child: ${codeToWrap},\n)${finalComma}`;

      default:
        return originalCode; // Fallback
    }
  };

  const compileDartCode = async (isReload: boolean) => {
    if (!dartCode.trim()) return

    setIsCompiling(true)
    try {
      const response = await fetch(`${apiHost}/api/v3/${isReload ? 'compileNewDDCReload' : 'compileNewDDC'}`, { // compileNewDDCReload
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
          setCompiledJs(result.result)
          setDeltaDill(result.deltaDill || "")
          setLastCompiledCode(dartCode);
          // Send compiled JS to iframe after a short delay to ensure iframe is ready
          setTimeout(async () => {
            var jsb = decorateJavaScript(result.result, {
              modulesBaseUrl: result.modulesBaseUrl,
              isNewDDC: true,
              reload: isReload,
              isFlutter: true,
            });
            if (!isReload) await resetIframe(); // Reset iframe before sending new code
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

      const newCode = await response.text();

      if (response.ok && newCode.trim() !== "") {
        setDartCode(newCode);
        setAiInteractionResult({ originalCode, newCode });
        analyzeDartCode(newCode); // Re-analyze the new code
      } else {
        console.error("AI Modification failed:", response.status, await response.text());
        // Opsional: tampilkan pesan error kepada user
      }
    } catch (error) {
      console.error("AI Modification request error:", error);
    } finally {
      setIsAiLoading(false);
      setAiPrompt(""); // Reset prompt input
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
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

      const newCode = await response.text();

      if (response.ok && newCode.trim() !== "") {
        setDartCode(newCode);
        setAiInteractionResult({ originalCode, newCode });
        analyzeDartCode(newCode);
      } else {
        console.error("AI Generation failed:", response.status, await response.text());
        // Opsional: tampilkan pesan error kepada user
      }
    } catch (error) {
      console.error("AI Generation request error:", error);
    } finally {
      setIsAiLoading(false);
      setAiPrompt("");
      setAttachedFiles([]); // Reset files
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachedFiles(Array.from(e.target.files));
    }
  };

  const formatDartCode = async () => {
    // 💡 Pastikan editor sudah siap dan ambil kode TERBARU langsung darinya
    if (!editorRef.current || !dartCode.trim()) return;
    const currentCode = editorRef.current.getValue();

    setIsFormatting(true);
    try {
      // Get current cursor position
      const position = editorRef.current.getPosition();
      const model = editorRef.current.getModel();
      if (!model || !position) return;

      // Convert position to offset
      const offset = model.getOffsetAt(position);

      const response = await fetch(`${apiHost}/api/v3/format`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: JSON.stringify({
          // ✅ Gunakan `currentCode`, bukan `dartCode` dari state
          source: currentCode,
          offset: offset,
        }),
      });

      if (response.ok) {
        const result: DartFormatResult = await response.json();

        // Update state React, yang akan mengupdate value editor
        setDartCode(result.source);

        // Restore cursor position after a short delay to allow editor to update
        setTimeout(() => {
          if (editorRef.current && model) {
            const newPosition = model.getPositionAt(result.offset);
            editorRef.current.setPosition(newPosition);
            editorRef.current.focus();
          }
        }, 100);

        // Re-analyze the formatted code
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

    // Update editor word wrap setting
    if (editorRef.current) {
      editorRef.current.updateOptions({ wordWrap: newWrap })
    }
  }
  const toggleWordWrapRef = useRef(toggleWordWrap);

  useEffect(() => {
    toggleWordWrapRef.current = toggleWordWrap;
  });

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


  function decorateJavaScript(
    javaScript: string,
    {
      modulesBaseUrl,
      isNewDDC,
      reload,
      isFlutter,
    }: {
      modulesBaseUrl?: string
      isNewDDC: boolean
      reload: boolean
      isFlutter: boolean
    }
  ): string {
    if (reload) return javaScript
    // javaScript = "alert('hello world')"; // Uncomment for debug

    let script = ""

    if (isNewDDC) {
      // Redirect print messages to the host.
      script += `
function dartPrint(message) {
  parent.postMessage({
    'sender': 'frame',
    'type': 'stdout',
    'message': message.toString(),
  }, '*');
}
`

      // JS exception handling
      script += `
window.onerror = function(message, url, line, column, error) {
  var errorMessage = error == null ? '' : ', error: ' + error;
  parent.postMessage({
    'sender': 'frame',
    'type': 'jserr',
    'message': message + errorMessage
  }, '*');
};
`

      // Set require.js config if modulesBaseUrl provided
      if (modulesBaseUrl) {
        script += `
require.config({
  "baseUrl": "${modulesBaseUrl}",
  "waitSeconds": 60,
  "onNodeCreated": function(node, config, id, url) { node.setAttribute('crossorigin', 'anonymous'); }
});
`
      }

      // Wrap compiled JS
      script += `let __ddcInitCode = function() {${javaScript}};\n`

      script += `
function contextLoaded() {
  __ddcInitCode();
  dartDevEmbedder.runMain('package:dartpad_sample/bootstrap.dart', {});
}
`
      if (isFlutter) {
        script += `
function moduleLoaderLoaded() {
  require(["dart_sdk_new", "flutter_web_new"], contextLoaded);
}
`
      } else {
        script += `
function moduleLoaderLoaded() {
  require(["dart_sdk_new"], contextLoaded);
}
`
      }
      script += `require(["ddc_module_loader"], moduleLoaderLoaded);\n`
    } else {
      // Redirect print messages to the host.
      script += `
function dartPrint(message) {
  parent.postMessage({
    'sender': 'frame',
    'type': 'stdout',
    'message': message.toString()
  }, '*');
}
`

      // Unload previous version
      script += `
require.undef('dartpad_main');
`

      // JS exception handling
      script += `
window.onerror = function(message, url, line, column, error) {
  var errorMessage = error == null ? '' : ', error: ' + error;
  parent.postMessage({
    'sender': 'frame',
    'type': 'stderr',
    'message': message + errorMessage
  }, '*');
};
`

      // Set require.js config if modulesBaseUrl provided
      if (modulesBaseUrl) {
        script += `
require.config({
  "baseUrl": "${modulesBaseUrl}",
  "waitSeconds": 60,
  "onNodeCreated": function(node, config, id, url) { node.setAttribute('crossorigin', 'anonymous'); }
});
`
      }

      script += javaScript + "\n"

      script += `
require(['dart_sdk'],
  function(sdk) {
    'use strict';
    sdk.developer._extensions.clear();
    sdk.dart.hotRestart();
  }
);

require(["dartpad_main", "dart_sdk"], function(dartpad_main, dart_sdk) {
  // SDK initialization.
  dart_sdk.dart.setStartAsyncSynchronously(true);
  dart_sdk._isolate_helper.startRootIsolate(() => {}, []);

  // Loads the \`dartpad_main\` module and runs its bootstrapped main method.
  for (var prop in dartpad_main) {
    if (prop.endsWith("bootstrap")) {
      dartpad_main[prop].main();
    }
  }
});
`
    }

    return script
  }

  const handlePanelResize = (sizes: number[]) => {
    const approximateWidth = Math.round((sizes[1] / 100) * 1200)
    setPreviewWidth(approximateWidth)
  }

  const errorCount = analysisResult?.issues.filter((issue) => issue.kind === "error").length || 0
  const warningCount = analysisResult?.issues.filter((issue) => issue.kind === "warning").length || 0

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Pastikan pesan dari iframe yang benar (opsional: cek origin)
      if (!event.data || typeof event.data !== "object") return
      if (event.data.sender !== "frame") return

      if (event.data.type === "stdout") {
        // Log output dari print()
        setLogs((prev) => [...prev, { type: "stdout", message: event.data.message }])
        console.log("[Flutter stdout]", event.data.message)
      } else if (event.data.type === "jserr" || event.data.type === "stderr") {
        // Log error JS
        setLogs((prev) => [...prev, { type: "jserr", message: event.data.message }])
        console.error("[Flutter jserr]", event.data.message)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      {/* Mobile Tabs - moved to top level */}
      {isMobile && (
        <div className="bg-card border-b border-border flex">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex-1 px-3 py-2 text-xs font-normal text-center transition-colors relative ${activeTab === "editor" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Editor
            {activeTab === "editor" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex-1 px-3 py-2 text-xs font-normal text-center transition-colors relative ${activeTab === "preview" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Preview
            {activeTab === "preview" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1">
        {/* Desktop Layout */}
        {!isMobile && (
          <ResizablePanelGroup direction="horizontal" className="h-full" onLayout={handlePanelResize}>
            {/* Editor Panel with Header */}
            <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
              <div className="h-full flex flex-col bg-background relative">
                {/* Header - now inside editor panel */}
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
                    <Select onValueChange={handleSampleSelect}>
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
                    {/* Analysis Status */}
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
                      onClick={() => {
                        setAiInteractionResult(null);
                        setAiPromptConfig({ visible: true, mode: 'generation' });
                      }}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 md:px-3"
                      title="Generate Code with AI"
                    >
                      <Sparkles className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden md:inline">Generate</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={compileDartCode.bind(null, false)}
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
                    {deltaDill.length > 20 ? (
                      <Button variant="ghost" size="sm" onClick={compileDartCode.bind(null, true)} disabled={isCompiling || dartCode === lastCompiledCode} className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 md:px-3" title="Hot Reload">
                        {isCompiling ? <div className="w-3 h-3 md:w-4 md:h-4 border border-current border-t-transparent rounded-full animate-spin md:mr-1" /> : <RefreshCw className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />}
                        <span className="hidden md:inline">Hot Reload</span>
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Editor and Logs Panel */}
                <ResizablePanelGroup direction="vertical" className="flex-1">
                  {/* Editor */}
                  <ResizablePanel defaultSize={isLogsExpanded ? 70 : 100} minSize={30}>
                    <div className="h-full overflow-y-auto">
                      <Editor
                        height="100%"
                        defaultLanguage="dart"
                        value={dartCode}
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        theme={useTheme().theme === 'dark' ? 'vs-dark' : 'vs-light'}
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
                          // Enable code actions and lightbulb
                          lightbulb: {
                            enabled: undefined,
                          },

                        }}
                      />
                    </div>
                  </ResizablePanel>

                  {/* Logs Panel */}
                  {isLogsExpanded && (
                    <>
                      <ResizableHandle className="bg-border hover:bg-accent active:bg-primary transition-colors" />
                      <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
                        <div className="h-full bg-card flex flex-col">
                          {/* Logs Header */}
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

                          {/* Logs Content */}
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
                {/* 1. AI Loading Overlay */}
                {isAiLoading && (
                  <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center z-20 backdrop-blur-[2px]">
                    <div className="flex items-center gap-3 bg-card px-6 py-4 rounded-lg shadow-lg border border-primary/30">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-foreground text-lg font-medium">AI is modifying your code...</span>
                    </div>
                  </div>
                )}

                {/* 2. AI Prompt Input Overlay */}
                {aiPromptConfig.visible && (
                  <div
                    className="absolute inset-0 bg-background/40 flex items-start justify-center z-20 pt-20 backdrop-blur-[1px]"
                    onClick={() => setAiPromptConfig({ visible: false, mode: null })} // Klik di luar untuk menutup
                  >
                    <div
                      className="bg-card rounded-lg shadow-2xl w-full max-w-2xl border border-primary/50"
                      onClick={(e) => e.stopPropagation()} // Mencegah penutupan saat klik di dalam
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

                        {true && (
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
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. AI Revert Banner */}
                {aiInteractionResult && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card text-foreground rounded-lg shadow-lg flex items-center gap-4 px-4 py-2 z-10 border border-border animate-fade-in-up">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="text-sm">Code has been updated by AI.</span>
                    <Separator orientation="vertical" className="h-4 bg-border" />
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
                          setDartCode(aiInteractionResult.originalCode);
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
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle className="bg-border hover:bg-accent active:bg-primary transition-colors" />

            {/* Preview Panel - now clean without header */}
            <ResizablePanel defaultSize={32} minSize={20} maxSize={35}>
              <div className="h-full bg-card flex flex-col">
                <div className="flex-1 overflow-auto">
                  <iframe
                    ref={iframeRef}
                    src="/frame.html"
                    className="w-full h-full border-0"
                    title="Flutter App Preview"
                    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin"
                    allow="clipboard-write"
                    style={{ border: "none", width: "100%", height: "100%" }}
                  />
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
              <div className="flex-1 flex flex-col bg-background">
                {/* Mobile Header */}
                <div className="bg-card border-b border-border px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div></div>
                    <h1 className="text-foreground font-semibold text-sm">DartIDE</h1>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={formatDartCode}
                      disabled={isFormatting}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent px-2"
                    >
                      {isFormatting ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <AlignLeft className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={compileDartCode.bind(null, false)}
                      disabled={isCompiling}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent px-2"
                    >
                      {isCompiling ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex-1">
                  <Editor
                    height="100%"
                    defaultLanguage="dart"
                    value={dartCode}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme={useTheme().theme === 'dark' ? 'vs-dark' : 'vs-light'}
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
              <div className="flex-1 bg-background overflow-auto">
                <iframe
                  ref={iframeRef}
                  src="/frame.html"
                  className="w-full h-full border-0"
                  title="Flutter App Preview"
                  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin"
                  allow="clipboard-write"
                  style={{ border: "none", width: "100%", height: "100%" }}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="bg-card border-t border-border px-4 py-1 flex items-center justify-between text-xs text-muted-foreground h-8 shrink-0">
        {/* Sisi Kiri: Channel Switcher */}
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
              if (isLogsExpanded) {
                setIsLogsExpanded(false)
                setLogsHeight(0)
              } else {
                setIsLogsExpanded(true)
                setLogsHeight(defaultLogsHeight)
              }
            }}
            className="text-muted-foreground hover:text-foreground hover:bg-accent h-6 w-6"
            title="Toggle Logs"
          >
            {isLogsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
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

        {/* Sisi Kanan: Info Versi */}
        <div className="flex items-center gap-4">
          <span>Dart: {versionInfo.dartVersion}</span>
          <Separator orientation="vertical" className="h-4 bg-border" />
          <span>Flutter: {versionInfo.flutterVersion}</span>
        </div>
      </div>
    </div>
  )
}
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