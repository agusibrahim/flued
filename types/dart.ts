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