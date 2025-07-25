export const detectFlutterWidget = (model: any, position: any): { widgetName: string; range: any } | null => {
    try {
        const wordAtPosition = model.getWordAtPosition(position)
        if (!wordAtPosition) return null
        const word = wordAtPosition.word
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

export const findWidgetBoundaries = (model: any, position: any): { start: any; end: any } | null => {
    try {
        const wordInfo = model.getWordAtPosition(position);
        if (!wordInfo) return null;
        const startPos = {
            lineNumber: position.lineNumber,
            column: wordInfo.startColumn,
        };
        let parenCount = 0;
        let foundFirstParen = false;
        for (let l = position.lineNumber; l <= model.getLineCount(); l++) {
            const lineContent = model.getLineContent(l);
            const startCol = l === position.lineNumber ? wordInfo.endColumn - 1 : 0;
            for (let c = startCol; c < lineContent.length; c++) {
                const char = lineContent[c];
                if (!foundFirstParen) {
                    if (char === '(') {
                        foundFirstParen = true;
                        parenCount++;
                    }
                    else if (char !== ' ' && char !== '\t') {
                        return null;
                    }
                } else {
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
                if (foundFirstParen && parenCount === 0) {
                    let endPos = { lineNumber: l, column: c + 2 };
                    for (let sl = l; sl <= model.getLineCount(); sl++) {
                        const subLine = model.getLineContent(sl);
                        const subStartCol = sl === l ? c + 1 : 0;
                        let stop = false;
                        for (let sc = subStartCol; sc < subLine.length; sc++) {
                            const subChar = subLine[sc];
                            if (subChar === ',') {
                                endPos = { lineNumber: sl, column: sc + 2 };
                                stop = true;
                                break;
                            }
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
        return null;
    } catch (error) {
        console.error('Error finding widget boundaries:', error);
        return null;
    }
};

export const generateWrapCode = (originalCode: string, wrapperType: string): string => {
    const trimmedOriginal = originalCode.trim();
    const hadTrailingComma = trimmedOriginal.endsWith(',');
    const codeToWrap = hadTrailingComma
        ? trimmedOriginal.slice(0, -1).trim()
        : trimmedOriginal;
    const indent = '  ';
    const finalComma = hadTrailingComma ? ',' : '';
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
            return originalCode;
    }
};