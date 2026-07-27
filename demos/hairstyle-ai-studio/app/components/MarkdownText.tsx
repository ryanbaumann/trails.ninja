
import React from 'react';

interface MarkdownTextProps {
  text: string;
  className?: string;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ text, className = "" }) => {
  if (!text) return null;

  // Clean up surrounding quotes often returned by LLMs
  const cleanText = text.replace(/^["']|["']$/g, '');

  // Split by bold (**...**) and italic (*...*) markers
  // The capturing group () ensures the delimiters and content are included in the result array
  const parts = cleanText.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return (
    <span className={`break-words whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-gray-100 dark:bg-gray-800 rounded px-1 text-sm font-mono">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};
