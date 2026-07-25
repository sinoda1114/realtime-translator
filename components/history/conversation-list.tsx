import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/i18n/translate";
import type { ConversationSummary } from "@/types/conversation";
import type { UiLanguage } from "@/types/settings";
import { ConversationCard } from "./conversation-card";

interface ConversationListProps {
  conversations: ConversationSummary[];
  uiLanguage: UiLanguage;
  onDelete: (id: string) => void;
}

export function ConversationList({ conversations, uiLanguage, onDelete }: ConversationListProps) {
  if (conversations.length === 0) {
    return <EmptyState message={t(uiLanguage, "まだ会話履歴がありません")} />;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {conversations.map((conversation) => (
        <ConversationCard
          key={conversation.id}
          conversation={conversation}
          uiLanguage={uiLanguage}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
