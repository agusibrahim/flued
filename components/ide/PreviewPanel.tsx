"use client"

import React from 'react';

interface PreviewPanelProps {
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export function PreviewPanel({ iframeRef }: PreviewPanelProps) {
    return (
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
    );
}