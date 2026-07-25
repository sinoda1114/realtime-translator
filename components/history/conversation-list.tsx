import { EmptyState } from "@/components/ui/empty-state";
import type { ConversationSummary } from "@/types/conversation";
import { ConversationCard } from "./conversation-card";

interface ConversationListProps {
  conversations: ConversationSummary[];
  onDelete: (id: string) => void;
}

export function ConversationList({ conversations, onDelete }: ConversationListProps) {
  if (conversations.length === 0) {
    return <EmptyState message="まだ会話履歴がありません" />;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {conversations.map((conversation) => (
        <ConversationCard key={conversation.id} conversation={conversation} onDelete={onDelete} />
      ))}
    </div>
  );
}
