import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fileToBase64 = (file: File): Promise<string> => {
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

export const decorateJavaScript=(
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
  ): string => {
    if (reload) return javaScript
    let script = ""
    if (isNewDDC) {
      script += `\nfunction dartPrint(message) {\n  parent.postMessage({\n    'sender': 'frame',\n    'type': 'stdout',\n    'message': message.toString(),\n  }, '*');\n}\n`
      script += `\nwindow.onerror = function(message, url, line, column, error) {\n  var errorMessage = error == null ? '' : ', error: ' + error;\n  parent.postMessage({\n    'sender': 'frame',\n    'type': 'jserr',\n    'message': message + errorMessage\n  }, '*');\n};\n`
      if (modulesBaseUrl) {
        script += `\nrequire.config({\n  "baseUrl": "${modulesBaseUrl}",\n  "waitSeconds": 60,\n  "onNodeCreated": function(node, config, id, url) { node.setAttribute('crossorigin', 'anonymous'); }\n});\n`
      }
      script += `let __ddcInitCode = function() {${javaScript}};\n`
      script += `\nfunction contextLoaded() {\n  __ddcInitCode();\n  dartDevEmbedder.runMain('package:dartpad_sample/bootstrap.dart', {});\n}\n`
      if (isFlutter) {
        script += `\nfunction moduleLoaderLoaded() {\n  require(["dart_sdk_new", "flutter_web_new"], contextLoaded);\n}\n`
      } else {
        script += `\nfunction moduleLoaderLoaded() {\n  require(["dart_sdk_new"], contextLoaded);\n}\n`
      }
      script += `require(["ddc_module_loader"], moduleLoaderLoaded);\n`
    } else {
      script += `\nfunction dartPrint(message) {\n  parent.postMessage({\n    'sender': 'frame',\n    'type': 'stdout',\n    'message': message.toString()\n  }, '*');\n}\n`
      script += `\nrequire.undef('dartpad_main');\n`
      script += `\nwindow.onerror = function(message, url, line, column, error) {\n  var errorMessage = error == null ? '' : ', error: ' + error;\n  parent.postMessage({\n    'sender': 'frame',\n    'type': 'stderr',\n    'message': message + errorMessage\n  }, '*');\n};\n`
      if (modulesBaseUrl) {
        script += `\nrequire.config({\n  "baseUrl": "${modulesBaseUrl}",\n  "waitSeconds": 60,\n  "onNodeCreated": function(node, config, id, url) { node.setAttribute('crossorigin', 'anonymous'); }\n});\n`
      }
      script += javaScript + "\n"
      script += `\nrequire(['dart_sdk'],\n  function(sdk) {\n    'use strict';\n    sdk.developer._extensions.clear();\n    sdk.dart.hotRestart();\n  }\n);\n\nrequire(["dartpad_main", "dart_sdk"], function(dartpad_main, dart_sdk) {\n  dart_sdk.dart.setStartAsyncSynchronously(true);\n  dart_sdk._isolate_helper.startRootIsolate(() => {}, []);\n  for (var prop in dartpad_main) {\n    if (prop.endsWith("bootstrap")) {\n      dartpad_main[prop].main();\n    }\n  }\n});\n`
    }
    return script
  }