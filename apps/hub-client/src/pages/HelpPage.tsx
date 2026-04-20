import { useParams, Navigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import gettingStartedContent from "../help/getting-started.md?raw";
import agentSetupContent from "../help/agent-setup.md?raw";
import architectureContent from "../help/architecture.md?raw";
import alertsAndRetentionContent from "../help/alerts-and-retention.md?raw";
import profileAndSecurityContent from "../help/profile-and-security.md?raw";
import faqContent from "../help/faq.md?raw";

const TOPICS = [
  { id: "getting-started", content: gettingStartedContent },
  { id: "agent-setup", content: agentSetupContent },
  { id: "alerts-and-retention", content: alertsAndRetentionContent },
  { id: "profile-and-security", content: profileAndSecurityContent },
  { id: "architecture", content: architectureContent },
  { id: "faq", content: faqContent },
] as const;

const md: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-white mt-0 mb-6 pb-3 border-b border-gray-800">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-white mt-8 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-200 mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-gray-300 leading-relaxed mb-4">{children}</p>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-brand-400 hover:text-brand-300 hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-gray-300 space-y-1 mb-4 ml-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-gray-300 space-y-1 mb-4 ml-2">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-brand-600 pl-4 my-4 text-gray-400 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-gray-800 my-8" />,
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="block text-sm text-gray-200 whitespace-pre overflow-x-auto" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-gray-800 text-brand-300 text-sm px-1.5 py-0.5 rounded" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 overflow-x-auto text-sm leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left text-gray-200 font-semibold px-3 py-2 border border-gray-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="text-gray-300 px-3 py-2 border border-gray-700">{children}</td>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-gray-800/40">{children}</tr>
  ),
};

export function HelpPage() {
  const { topicId } = useParams<{ topicId: string }>();

  if (!topicId) {
    return <Navigate to="/help/getting-started" replace />;
  }

  const current = TOPICS.find((t) => t.id === topicId) ?? TOPICS[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
          {current.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
