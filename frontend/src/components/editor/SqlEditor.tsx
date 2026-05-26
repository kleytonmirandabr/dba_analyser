import { useEffect, useRef } from 'react'
import { EditorView, keymap, placeholder as phPlugin } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { sql } from '@codemirror/lang-sql'
import { autocompletion } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { useThemeStore } from '../../stores/theme.store'

interface SqlEditorProps {
  value: string
  onChange: (val: string) => void
  onExecute?: () => void
  placeholder?: string
}

const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1f2937' },
  '.cm-gutters': { backgroundColor: '#f9fafb', borderRight: '1px solid #e5e7eb' },
  '.cm-activeLineGutter': { backgroundColor: '#f3f4f6' },
  '.cm-activeLine': { backgroundColor: '#f3f4f6' },
  '.cm-cursor': { borderLeftColor: '#1f2937' },
  '.cm-selectionBackground': { backgroundColor: '#dbeafe !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#bfdbfe !important' },
})

export default function SqlEditor({ value, onChange, onExecute, placeholder }: SqlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const theme = useThemeStore(s => s.theme)
  const onChangeRef = useRef(onChange)
  const onExecuteRef = useRef(onExecute)
  onChangeRef.current = onChange
  onExecuteRef.current = onExecute

  useEffect(() => {
    if (!editorRef.current) return

    const executeKeymap = keymap.of([{
      key: 'Ctrl-Enter',
      mac: 'Cmd-Enter',
      run: () => { onExecuteRef.current?.(); return true },
    }])

    const state = EditorState.create({
      doc: value,
      extensions: [
        sql(),
        autocompletion(),
        executeKeymap,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        phPlugin(placeholder || 'SELECT * FROM table LIMIT 100;'),
        EditorView.lineWrapping,
        theme === 'dark' ? oneDark : lightTheme,
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    return () => { view.destroy() }
  }, [theme]) // recreate on theme change

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={editorRef} className="w-full h-full [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:overflow-auto" />
}
