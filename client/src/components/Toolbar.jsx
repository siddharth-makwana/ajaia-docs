import { useEditorState } from '@tiptap/react';

function Btn({ label, title, active, disabled, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'active' : ''} ${className}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default function Toolbar({ editor, disabled }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const d = disabled;
  const block = s.h1 ? 'h1' : s.h2 ? 'h2' : s.h3 ? 'h3' : 'p';

  const setBlock = (v) => {
    if (v === 'p') c().setParagraph().run();
    else c().setHeading({ level: Number(v[1]) }).run();
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="↶" title="Undo (Ctrl+Z)" disabled={d || !s.canUndo} onClick={() => c().undo().run()} />
      <Btn label="↷" title="Redo (Ctrl+Shift+Z)" disabled={d || !s.canRedo} onClick={() => c().redo().run()} />
      <span className="tb-sep" />
      <select className="tb-select" value={block} disabled={d} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="tb-sep" />
      <Btn label={<b>B</b>} title="Bold (Ctrl+B)" active={s.bold} disabled={d} onClick={() => c().toggleBold().run()} />
      <Btn label={<i>I</i>} title="Italic (Ctrl+I)" active={s.italic} disabled={d} onClick={() => c().toggleItalic().run()} />
      <Btn label={<u>U</u>} title="Underline (Ctrl+U)" active={s.underline} disabled={d} onClick={() => c().toggleUnderline().run()} />
      <Btn label={<s>S</s>} title="Strikethrough" active={s.strike} disabled={d} onClick={() => c().toggleStrike().run()} />
      <span className="tb-sep" />
      <Btn label="•" title="Bulleted list" active={s.bullet} disabled={d} onClick={() => c().toggleBulletList().run()} className="wide" />
      <Btn label="1." title="Numbered list" active={s.ordered} disabled={d} onClick={() => c().toggleOrderedList().run()} className="wide" />
      <Btn label="❝" title="Quote" active={s.quote} disabled={d} onClick={() => c().toggleBlockquote().run()} />
      <Btn label="―" title="Divider" disabled={d} onClick={() => c().setHorizontalRule().run()} />
      <Btn label="T̸" title="Clear formatting" disabled={d} onClick={() => c().unsetAllMarks().clearNodes().run()} />
    </div>
  );
}
