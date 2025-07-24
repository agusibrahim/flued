# **Flued \- A Smart Web-Based Flutter Editor**
<img width="920" height="2064" alt="Screenshot 2025-07-24 at 10 46 35" src="https://github.com/user-attachments/assets/d1eda39d-17d0-47bc-aaa5-8e18bd3f3bee" />

**Flued** is a sophisticated, fast, and modern web-based Flutter code editor. Built with Next.js and the Monaco Editor (the same engine behind VS Code), this application provides a feature-rich Flutter development experience directly in your browser.

This application is more than just a text editor; it's an interactive playground equipped with **Hot Reload**, **code analysis**, and **AI capabilities** to modify and generate code, making it the perfect tool for learning, prototyping, and experimenting with Flutter.

## **✨ Key Features**

Flued is packed with features designed to boost your productivity and creativity:

* **💻 Professional Code Editor**: Powered by Monaco Editor, providing syntax highlighting, code completion, and a responsive typing experience.  
* **⚡ True Hot Reload**: See changes to your Flutter UI instantly without needing to refresh the entire page, just like local development. The Hot Reload button is only active when there are code changes.  
* **🧠 Real-time Code Analysis**: Get immediate feedback on errors and warnings in your code as you type, helping you write cleaner code.  
* **💅 Automatic Code Formatting**: Tidy up your Dart code with a single click or a shortcut (Shift+Alt+F), maintaining consistency and readability.  
* **🤖 AI Code Modification & Generation**:  
  * **AI Modification**: Right-click on your code, select "AI Modification," and write a prompt to refactor existing code.  
  * **AI Generation**: Create new widgets or logic from scratch just by describing them in a prompt.  
* **💡 Smart Quick Fixes**:  
  * **Wrap with Widget**: Select a widget and automatically wrap it with common widgets (Column, Padding, Center, etc.).  
  * **Wrap with Widget...**: An option to wrap with a custom widget, with the widget name ready to be replaced.  
* **🚀 Code Snippets**: Speed up your coding with snippets for stless (StatelessWidget) and stfull (StatefulWidget).  
* **🌿 Flutter Channel Selection**: Easily switch between **Stable**, **Beta**, and **Main** Flutter versions to test the latest features. The active Dart & Flutter versions are displayed in the bottom bar.  
* **📱 Responsive Design**: An optimized experience for both desktop with resizable panels and mobile with tab-based navigation.  
* **🖱️ Full-Featured Context Menu**: Quick access to essential functions like Format, AI Modification, and Toggle Word Wrap directly from the right-click menu.  
* **📜 Comfortable Scrolling**: The editor has bottom padding (scrollBeyondLastLine), so the last line of code never gets stuck at the bottom of the screen.  
* **📝 State Management**: Your code is automatically saved in the browser's localStorage, so you won't lose your work when you refresh the page.

## **🛠️ Tech Stack**

* **Framework**: [Next.js](https://nextjs.org/) (React)  
* **Core Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)  
* **UI & Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)  
* **Backend Services**: [DartPad API](https://www.google.com/search?q=https://stable.api.dartpad.dev/) for compilation, analysis, formatting, and AI services.  

## **🚀 How to Run Locally**

To run this project in your local development environment, follow these steps:

1. **Clone this repository:**  
   git clone https://github.com/agusibrahim/flued.git  
   cd flued

2. **Install all dependencies using Bun:**  
   bun install

3. **Run the development server:**  
   bun run dev

4. Open [http://localhost:3080](http://localhost:3080) in your browser to see the result.

## **🤝 Contributing**

Contributions are highly welcome\! If you have ideas for new features, bug fixes, or other improvements, please feel free to:

1. **Fork** this repository.  
2. Create a new **Branch** (git checkout \-b feature/YourCoolFeature).  
3. **Commit** your changes (git commit \-m 'Add some cool feature').  
4. **Push** to the branch (git push origin feature/YourCoolFeature).  
5. Open a **Pull Request**.

## **📄 License**

This project is licensed under the MIT License. See the LICENSE file for more details.
