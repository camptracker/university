/**
 * ParableRenderer — renders parable markdown
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  text: string;
  answeringQuestion?: string | null;
  followUpQuestion?: string;
}

export default function ParableRenderer({ text, answeringQuestion, followUpQuestion }: Props) {
  return (
    <div className="lesson-content parable">
      {answeringQuestion && (
        <div className="parable-context">
          <p className="parable-context-label">Today's Question:</p>
          <p className="parable-context-question">{answeringQuestion}</p>
        </div>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
      {followUpQuestion && (
        <div className="parable-tomorrow">
          <p className="parable-tomorrow-label">Tomorrow's Question:</p>
          <p className="parable-tomorrow-question">{followUpQuestion}</p>
        </div>
      )}
    </div>
  );
}
